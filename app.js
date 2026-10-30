import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  firebaseConfig,
  ADMIN_UID
} from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const eventsRef = collection(db, "eventos");

const eventsList = document.querySelector("#eventsList");
const adminEventsList = document.querySelector("#adminEventsList");

const loginPanel = document.querySelector("#loginPanel");
const dashboardPanel = document.querySelector("#dashboardPanel");
const loginForm = document.querySelector("#loginForm");
const eventForm = document.querySelector("#eventForm");
const loginMessage = document.querySelector("#loginMessage");
const eventMessage = document.querySelector("#eventMessage");
const saveEventButton = document.querySelector("#saveEvent");
const cancelEditButton = document.querySelector("#cancelEdit");
const formTitle = document.querySelector("#formTitle");
const toast = document.querySelector("#toast");

function showToast(message) {
    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}



const openAdmin = document.getElementById("openAdmin");
const closeAdmin = document.getElementById("closeAdmin");
const adminModal = document.getElementById("adminModal");




let editingId = null;
let cachedEvents = [];

document.querySelector("#year").textContent =
  new Date().getFullYear();




/* AVISOS NA TELA */



document.querySelector("#openAdmin").addEventListener(
  "click",
  openModal
);

document.querySelector("#closeAdmin").addEventListener(
  "click",
  closeModal
);

adminModal.addEventListener("click", event => {
  if (event.target === adminModal) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !adminModal.hidden) {
    closeModal();
  }
});

/* FORMATAÇÃO DAS DATAS */

function dateParts(dateString) {
  const [year, month, day] = String(dateString || "")
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return {
      day: "--",
      month: "---",
      formatted: "Data a confirmar"
    };
  }

  const date = new Date(year, month - 1, day);

  return {
    day: String(day).padStart(2, "0"),

    month: date.toLocaleDateString("pt-BR", {
      month: "short"
    }).replace(".", "").toUpperCase(),

    formatted: date.toLocaleDateString("pt-BR")
  };
}

/* PROTEÇÃO DO TEXTO INSERIDO NO HTML */

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

/* DATA ATUAL */

function localDateISO() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* ORGANIZAÇÃO DOS EVENTOS */

function isUpcoming(event) {
  return String(event.data || "") >= localDateISO();
}

function sortedEvents(events) {
  return [...events].sort((a, b) =>
    String(a.data).localeCompare(String(b.data)) ||
    String(a.horario).localeCompare(String(b.horario))
  );
}

/* AGENDA VISÍVEL PARA OS VISITANTES */

function renderPublicEvents(events) {
 const upcoming = sortedEvents(events);

  if (!upcoming.length) {
    eventsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">♡</span>

        <h3>Nenhuma ação anunciada no momento</h3>

        <p>
          Novas atividades serão divulgadas aqui
          assim que forem confirmadas.
        </p>
      </div>
    `;

    return;
  }

  eventsList.innerHTML = upcoming.map(event => {
    const date = dateParts(event.data);

    return `
      <article class="event-card">

        <div class="event-date">
          <strong>${safeText(date.day)}</strong>
          <span>${safeText(date.month)}</span>
        </div>

        <div>
          <h3>${safeText(event.titulo)}</h3>

          <p>${safeText(event.descricao)}</p>

          <div class="event-meta">
            <span>◷ ${safeText(event.horario)}</span>
            <span>⌖ ${safeText(event.local)}</span>
          </div>

          ${
            event.extra
              ? `<p class="event-extra">${safeText(event.extra)}</p>`
              : ""
          }
        </div>

      </article>
    `;
  }).join("");
}

/* AGENDA DA ÁREA ADMINISTRATIVA */

function renderAdminEvents(events) {
  const ordered = sortedEvents(events);

  if (!ordered.length) {
    adminEventsList.innerHTML = `
      <p class="admin-description">
        Nenhuma ação cadastrada ainda.
      </p>
    `;

    return;
  }

  adminEventsList.innerHTML = ordered.map(event => {
    const date = dateParts(event.data);

    return `
      <div class="admin-event-row">

        <div>
          <strong>${safeText(event.titulo)}</strong>

          <small>
            ${safeText(date.formatted)}
            ·
            ${safeText(event.horario)}
          </small>
        </div>

        <div class="admin-event-actions">

          <button
            type="button"
            data-edit="${safeText(event.id)}"
          >
            Editar
          </button>

          <button
            type="button"
            class="delete-button"
            data-delete="${safeText(event.id)}"
          >
            Excluir
          </button>

        </div>

      </div>
    `;
  }).join("");

  adminEventsList.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      startEdit(button.dataset.edit);
    });
  });

  adminEventsList.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => {
      removeEvent(button.dataset.delete);
    });
  });
}

/* BUSCAR EVENTOS NO FIREBASE */

async function loadEvents() {
  try {
    const snapshot = await getDocs(
      query(eventsRef, orderBy("data", "asc"))
    );

    cachedEvents = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    renderPublicEvents(cachedEvents);

    if (auth.currentUser &&
        auth.currentUser.uid === ADMIN_UID) {
      renderAdminEvents(cachedEvents);
    }

  } catch (error) {
    console.error(error);

    eventsList.innerHTML = `
      <div class="empty-state">
        <h3>Não foi possível carregar a agenda</h3>

        <p>
          Verifique a configuração do Firebase
          e tente novamente mais tarde.
        </p>
      </div>
    `;
  }
}

/* LOGIN DO ADMINISTRADOR */

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  loginMessage.textContent = "Verificando acesso…";

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      document.querySelector("#adminEmail").value.trim(),
      document.querySelector("#adminPassword").value
    );

    if (credential.user.uid !== ADMIN_UID) {
      await signOut(auth);

      loginMessage.textContent =
        "Este usuário não tem permissão administrativa.";

      return;
    }

    loginForm.reset();
    showDashboard();

    await loadEvents();

  } catch (error) {
    console.error(error);

    loginMessage.textContent =
      "Não foi possível entrar. Confira o e-mail e a senha.";
  }
});

/* VERIFICA SE EXISTE UMA SESSÃO */

onAuthStateChanged(auth, user => {
  if (user && user.uid === ADMIN_UID) {
    showDashboard();
    loadEvents();
  } else {
    showLogin();
  }
});

function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboardPanel.hidden = true;

  resetEventForm();
  adminEventsList.innerHTML = "";
}

/* SAIR DA ÁREA ADMINISTRATIVA */

document.querySelector("#logoutButton").addEventListener(
  "click",
  async () => {
    await signOut(auth);

    showLogin();

    showToast("Você saiu da área administrativa.");
  }
);

/* LIMPAR O FORMULÁRIO */

function resetEventForm() {
  eventForm.reset();

  editingId = null;

  formTitle.textContent = "Adicionar nova ação";
  saveEventButton.textContent = "Publicar ação";

  cancelEditButton.hidden = true;
  eventMessage.textContent = "";
}

/* EDITAR EVENTO */

function startEdit(id) {
  const event = cachedEvents.find(item => item.id === id);

  if (!event) return;

  editingId = id;

  document.querySelector("#eventTitle").value =
    event.titulo || "";

  document.querySelector("#eventDescription").value =
    event.descricao || "";

  document.querySelector("#eventDate").value =
    event.data || "";

  document.querySelector("#eventTime").value =
    event.horario || "";

  document.querySelector("#eventLocation").value =
    event.local || "";

  document.querySelector("#eventContact").value =
    event.extra || "";

  formTitle.textContent = "Editar ação";
  saveEventButton.textContent = "Salvar alterações";

  cancelEditButton.hidden = false;
  eventMessage.textContent = "";

  document.querySelector("#eventTitle").focus();
}

cancelEditButton.addEventListener(
  "click",
  resetEventForm
);

/* CADASTRAR OU ATUALIZAR EVENTO */

eventForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!auth.currentUser ||
      auth.currentUser.uid !== ADMIN_UID) {
    eventMessage.textContent =
      "Entre com a conta administrativa para publicar.";

    return;
  }

  const payload = {
    titulo: document.querySelector("#eventTitle").value.trim(),

    descricao: document.querySelector("#eventDescription")
      .value.trim(),

    data: document.querySelector("#eventDate").value,

    horario: document.querySelector("#eventTime").value,

    local: document.querySelector("#eventLocation")
      .value.trim(),

    extra: document.querySelector("#eventContact")
      .value.trim(),

    atualizadoEm: serverTimestamp()
  };

  if (
    !payload.titulo ||
    !payload.descricao ||
    !payload.data ||
    !payload.horario ||
    !payload.local
  ) {
    eventMessage.textContent =
      "Preencha todos os campos obrigatórios.";

    return;
  }

  saveEventButton.disabled = true;
  saveEventButton.textContent = "Salvando…";

  const wasEditing = Boolean(editingId);

  try {
    if (wasEditing) {
      await updateDoc(
        doc(db, "eventos", editingId),
        payload
      );
    } else {
      await addDoc(eventsRef, {
        ...payload,
        criadoEm: serverTimestamp()
      });
    }

    resetEventForm();

    await loadEvents();

    showToast(
      wasEditing
        ? "Ação atualizada com sucesso."
        : "Ação publicada com sucesso."
    );

  } catch (error) {
    console.error(error);

    eventMessage.textContent =
      "Não foi possível salvar. Confira as regras e a configuração do Firebase.";

  } finally {
    saveEventButton.disabled = false;
    saveEventButton.textContent = "Publicar ação";
  }
});

/* EXCLUIR EVENTO */

async function removeEvent(id) {
  const item = cachedEvents.find(event => event.id === id);

  if (!item) return;

  const confirmed = window.confirm(
    `Excluir a ação "${item.titulo}"? Essa alteração não pode ser desfeita.`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "eventos", id));

    await loadEvents();

    showToast("Ação excluída.");

  } catch (error) {
    console.error(error);

    showToast(
      "Não foi possível excluir. Confira as regras do Firebase."
    );
  }
}

/* CARREGAR A AGENDA AO ABRIR O SITE */

loadEvents();



/* ABRIR E FECHAR A ÁREA ADMINISTRATIVA */

function openModal() {
    if (!adminModal) return;

    adminModal.hidden = false;
    document.body.style.overflow = "hidden";
}

function closeModal() {
    if (!adminModal) return;

    adminModal.hidden = true;
    document.body.style.overflow = "";

    if (loginMessage) loginMessage.textContent = "";
    if (eventMessage) eventMessage.textContent = "";
}

if (openAdmin && closeAdmin && adminModal) {
    openAdmin.addEventListener("click", openModal);
    closeAdmin.addEventListener("click", closeModal);

    adminModal.addEventListener("click", event => {
        if (event.target === adminModal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !adminModal.hidden) {
            closeModal();
        }
    });
}
