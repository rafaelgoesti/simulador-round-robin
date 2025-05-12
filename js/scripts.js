// Variáveis globais
let processes = [];
let timeline = [];
let currentTime = 0;
let quantum = 4;
let simulationInterval;
let isSimulating = false;

// Elementos do DOM
const simulatorForm = document.getElementById('simulator-form');
const processTable = document.getElementById('process-table');
const timelineContainer = document.getElementById('timeline-container');
const startSimulationBtn = document.getElementById('start-simulation');
const resetSimulationBtn = document.getElementById('reset-simulation');
const processCountElement = document.getElementById('process-count');
const avgWaitingTimeElement = document.getElementById('avg-waiting-time');
const avgTurnaroundTimeElement = document.getElementById('avg-turnaround-time');
const totalTimeElement = document.getElementById('total-time');

// Cores para os processos
const processColors = [
    '#44BB55', '#2E8B3E', '#5DCC6A', '#7EDC8B',
    '#e74c3c', '#c0392b', '#9b59b6', '#8e44ad',
    '#3498db', '#2980b9', '#1abc9c', '#16a085'
];

// Event Listeners
simulatorForm.addEventListener('submit', addProcess);
startSimulationBtn.addEventListener('click', startSimulation);
resetSimulationBtn.addEventListener('click', resetSimulation);

// Função para adicionar processo
function addProcess(e) {
    e.preventDefault();

    if (isSimulating) {
        showAlert('A simulação está em andamento. Reinicie para adicionar novos processos.', 'warning');
        return;
    }

    const name = document.getElementById('process-name').value || `P${processes.length + 1}`;
    const burstTime = parseInt(document.getElementById('burst-time').value) || 5;
    const arrivalTime = parseInt(document.getElementById('arrival-time').value) || 0;
    quantum = parseInt(document.getElementById('quantum').value) || 4;

    const newProcess = {
        id: processes.length + 1,
        name: name,
        arrivalTime: arrivalTime,
        burstTime: burstTime,
        remainingTime: burstTime,
        waitingTime: 0,
        turnaroundTime: 0,
        completed: false,
        startTime: null,
        finishTime: null,
        color: processColors[processes.length % processColors.length]
    };

    processes.push(newProcess);
    updateProcessTable();
    updateCounters();

    document.getElementById('process-name').value = '';
    document.getElementById('burst-time').value = '5';
    document.getElementById('process-name').focus();

    showAlert(`Processo "${name}" adicionado com sucesso!`, 'success');
}

// Atualizar tabela de processos
function updateProcessTable() {
    processTable.innerHTML = '';

    processes.forEach(process => {
        const row = document.createElement('tr');
        row.style.borderLeft = `4px solid ${process.color}`;

        let status = 'Pronto';
        let statusClass = 'primary';
        if (process.completed) {
            status = 'Concluído';
            statusClass = 'success';
        } else if (process.remainingTime < process.burstTime && process.remainingTime > 0) {
            status = 'Executando';
            statusClass = 'warning';
        }

        row.innerHTML = `
            <td><strong>${process.name}</strong></td>
            <td>${process.arrivalTime}</td>
            <td>${process.burstTime}</td>
            <td>${process.remainingTime}</td>
            <td><span class="badge bg-${statusClass}">${status}</span></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeProcess(${process.id})" ${isSimulating ? 'disabled' : ''}>
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        processTable.appendChild(row);
    });
}

// Remover processo
function removeProcess(id) {
    if (isSimulating) {
        showAlert('A simulação está em andamento. Reinicie para remover processos.', 'warning');
        return;
    }

    processes = processes.filter(process => process.id !== id);
    processes.forEach((process, index) => {
        process.id = index + 1;
    });

    updateProcessTable();
    updateCounters();
    showAlert('Processo removido com sucesso!', 'success');
}

// Iniciar simulação
function startSimulation() {
    if (isSimulating) {
        showAlert('A simulação já está em andamento!', 'warning');
        return;
    }

    if (processes.length === 0) {
        showAlert('Adicione pelo menos um processo para iniciar!', 'warning');
        return;
    }

    isSimulating = true;
    startSimulationBtn.disabled = true;
    resetSimulationBtn.disabled = true;

    timeline = [];
    currentTime = 0;

    const simProcesses = JSON.parse(JSON.stringify(processes));
    simProcesses.sort((a, b) => a.arrivalTime - b.arrivalTime);

    let readyQueue = [];
    simProcesses.forEach(process => {
        if (process.arrivalTime <= currentTime) {
            readyQueue.push(process);
        }
    });

    simulationInterval = setInterval(() => {
        if (readyQueue.length === 0 && simProcesses.some(p => !p.completed)) {
            const nextArrival = Math.min(...simProcesses
                .filter(p => !p.completed && p.arrivalTime > currentTime)
                .map(p => p.arrivalTime));

            if (nextArrival !== Infinity) {
                timeline.push({
                    processId: null,
                    processName: 'Espera',
                    processColor: '#6c757d',
                    startTime: currentTime,
                    endTime: nextArrival
                });

                currentTime = nextArrival;

                simProcesses.forEach(process => {
                    if (process.arrivalTime <= currentTime &&
                        !readyQueue.includes(process) &&
                        !process.completed) {
                        readyQueue.push(process);
                    }
                });
            }
        }

        if (readyQueue.length > 0) {
            const currentProcess = readyQueue.shift();

            if (currentProcess.startTime === null) {
                currentProcess.startTime = currentTime;
            }

            const execTime = Math.min(quantum, currentProcess.remainingTime);

            timeline.push({
                processId: currentProcess.id,
                processName: currentProcess.name,
                processColor: currentProcess.color,
                startTime: currentTime,
                endTime: currentTime + execTime,
                wasCompleted: currentProcess.remainingTime === execTime
            });

            currentProcess.remainingTime -= execTime;
            currentTime += execTime;

            simProcesses.forEach(process => {
                if (process.arrivalTime <= currentTime &&
                    !readyQueue.includes(process) &&
                    !process.completed &&
                    process !== currentProcess) {
                    readyQueue.push(process);
                }
            });

            if (currentProcess.remainingTime > 0) {
                readyQueue.push(currentProcess);
            } else {
                currentProcess.completed = true;
                currentProcess.finishTime = currentTime;
                currentProcess.turnaroundTime = currentProcess.finishTime - currentProcess.arrivalTime;
                currentProcess.waitingTime = currentProcess.turnaroundTime - currentProcess.burstTime;
            }
        }

        updateSimulationView();

        if (simProcesses.every(p => p.completed)) {
            clearInterval(simulationInterval);
            isSimulating = false;
            resetSimulationBtn.disabled = false;

            updateStatistics(simProcesses);

            processes.forEach(process => {
                const simProcess = simProcesses.find(p => p.id === process.id);
                if (simProcess) {
                    process.waitingTime = simProcess.waitingTime;
                    process.turnaroundTime = simProcess.turnaroundTime;
                    process.completed = true;
                    process.remainingTime = 0;
                    process.finishTime = simProcess.finishTime;
                }
            });

            updateProcessTable();
            showAlert('Simulação concluída com sucesso!', 'success');
        }
    }, 1500);
}

// Atualizar visualização da simulação
function updateSimulationView() {
    if (timeline.length > 0) {
        timelineContainer.innerHTML = `
            <h5 class="mb-3">Linha do Tempo da Execução</h5>
            <div class="timeline-scroll">
                <div class="d-flex overflow-auto pb-3" id="timeline-visual"></div>
            </div>
        `;

        const timelineVisual = document.getElementById('timeline-visual');

        timeline.forEach((segment, index) => {
            const isActive = index === timeline.length - 1;
            let segmentClass = 'new';

            if (segment.processId === null) {
                segmentClass = 'waiting';
            } else if (segment.wasCompleted) {
                segmentClass = 'completed';
            } else if (isActive) {
                segmentClass = 'running';
            }

            const timeSegment = document.createElement('div');
            timeSegment.className = `timeline-segment ${segmentClass}`;
            timeSegment.style.minWidth = '100px';
            timeSegment.style.padding = '10px';
            timeSegment.style.textAlign = 'center';
            timeSegment.style.marginRight = '5px';

            if (segment.processId) {
                timeSegment.innerHTML = `
                    <div style="color: ${segment.processColor}; font-size: 1.5rem;">
                        <i class="fas fa-microchip"></i>
                    </div>
                    <div class="fw-bold">${segment.processName}</div>
                    <div class="small text-muted">${segment.startTime}-${segment.endTime}</div>
                `;
            } else {
                timeSegment.innerHTML = `
                    <div style="color: #6c757d; font-size: 1.5rem;">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="fw-bold">Espera</div>
                    <div class="small text-muted">${segment.startTime}-${segment.endTime}</div>
                `;
            }

            timelineVisual.appendChild(timeSegment);
        });
    }

    updateCounters();
}

// Atualizar estatísticas
function updateStatistics(completedProcesses) {
    const totalWaiting = completedProcesses.reduce((sum, p) => sum + p.waitingTime, 0);
    const totalTurnaround = completedProcesses.reduce((sum, p) => sum + p.turnaroundTime, 0);

    avgWaitingTimeElement.textContent = (totalWaiting / completedProcesses.length).toFixed(1);
    avgTurnaroundTimeElement.textContent = (totalTurnaround / completedProcesses.length).toFixed(1);
    totalTimeElement.textContent = currentTime;
}

// Atualizar contadores
function updateCounters() {
    const completed = processes.filter(p => p.completed).length;
    processCountElement.textContent = `${processes.length} processo${processes.length !== 1 ? 's' : ''}`;
    totalTimeElement.textContent = currentTime;
}

// Reiniciar simulação
function resetSimulation() {
    clearInterval(simulationInterval);
    isSimulating = false;

    processes.forEach(p => {
        p.remainingTime = p.burstTime;
        p.completed = false;
        p.waitingTime = 0;
        p.turnaroundTime = 0;
        p.startTime = null;
        p.finishTime = null;
    });

    timeline = [];
    currentTime = 0;

    timelineContainer.innerHTML = `
        <i class="fas fa-film fa-3x text-muted mb-3"></i>
        <h5 class="text-muted">Simulação não iniciada</h5>
        <p class="text-muted">Adicione processos e clique em "Iniciar Simulação"</p>
    `;

    avgWaitingTimeElement.textContent = '0';
    avgTurnaroundTimeElement.textContent = '0';
    totalTimeElement.textContent = '0';

    updateProcessTable();
    updateCounters();

    startSimulationBtn.disabled = false;
    resetSimulationBtn.disabled = false;

    showAlert('Simulação reiniciada com sucesso!', 'success');
}

// Mostrar alerta
function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.querySelector('.simulator-container').prepend(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Alternar entre telas
document.getElementById('go-to-simulator').addEventListener('click', function () {
    document.getElementById('presentation-screen').classList.add('hidden');
    document.getElementById('simulator-screen').classList.remove('hidden');
});

document.getElementById('back-to-presentation').addEventListener('click', function () {
    document.getElementById('simulator-screen').classList.add('hidden');
    document.getElementById('presentation-screen').classList.remove('hidden');
});