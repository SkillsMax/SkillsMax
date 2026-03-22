import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCNokOSiV483vppPmDwtWs0nH1evzZwbjU",
    authDomain: "matriz-de-habilidades-c4bd5.firebaseapp.com",
    databaseURL: "https://matriz-de-habilidades-c4bd5-default-rtdb.firebaseio.com",
    projectId: "matriz-de-habilidades-c4bd5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'matriz_habilidades');

let empleados = [];
let criteriosPorPuesto = {};

onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    empleados = data?.empleados || [];
    criteriosPorPuesto = data?.criterios || {};
    renderizarTabla();
});

const sincronizar = () => set(dbRef, { empleados, criterios: criteriosPorPuesto });

document.getElementById("formEmpleado").addEventListener("submit", function(e) {
    e.preventDefault();
    const nombreNuevo = document.getElementById("nombre").value.trim();

    // VALIDACIÓN: No duplicar nombres
    if (empleados.some(emp => emp.nombre.toLowerCase() === nombreNuevo.toLowerCase())) {
        return alert("❌ Error: Este empleado ya está registrado.");
    }

    let nuevo = {
        nombre: nombreNuevo,
        puesto: document.getElementById("puesto").value.trim().toUpperCase(),
        cuadrilla: document.getElementById("cuadrilla").value,
        anios: document.getElementById("anios").value,
        peso: document.getElementById("peso").value,
        estatura: document.getElementById("estatura").value,
        escolaridad: document.getElementById("escolaridad").value,
        evaluacion: null, 
        detalleEvaluacion: [],
        fecha: "Pendiente"
    };

    empleados.push(nuevo);
    sincronizar();
    this.reset();
    alert("✅ Registro exitoso");
});

window.eliminarEmpleado = (i) => {
    if(confirm("¿Eliminar permanentemente?")) {
        empleados.splice(i, 1);
        sincronizar();
    }
};

function renderizarTabla() {
    document.getElementById("tablaEmpleados").innerHTML = empleados.map((e, i) => `
        <tr>
            <td>${e.nombre}</td>
            <td>${e.puesto}</td>
            <td><button class="btn-eliminar" onclick="eliminarEmpleado(${i})">Eliminar</button></td>
        </tr>
    `).join('');
}

document.getElementById("buscarEmpleado").addEventListener("keyup", function() {
    let f = this.value.toLowerCase();
    document.querySelectorAll("#tablaEmpleados tr").forEach(r => {
        r.style.display = r.cells[0].textContent.toLowerCase().includes(f) ? "" : "none";
    });
});
