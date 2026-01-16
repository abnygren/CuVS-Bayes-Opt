/**
 * Cu₃VS₄ Self-Validating Bayesian Optimization - Frontend Application
 * Handles data loading, display, and interactivity
 */

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    dataPath: 'data/',
    experimentsFile: 'experiments.json',
    recommendationsFile: 'recommendations.json',
    refreshInterval: null, // Set to milliseconds to enable auto-refresh
};

// =============================================================================
// State Management
// =============================================================================

const state = {
    experiments: [],
    recommendations: [],
    currentFilter: 'pending',
    currentSource: 'all',
    isLoading: true,
};

// =============================================================================
// Data Loading
// =============================================================================

async function loadData() {
    try {
        const [expResponse, recResponse] = await Promise.all([
            fetch(`${CONFIG.dataPath}${CONFIG.experimentsFile}`),
            fetch(`${CONFIG.dataPath}${CONFIG.recommendationsFile}`)
        ]);

        if (!expResponse.ok || !recResponse.ok) {
            throw new Error('Failed to load data files');
        }

        const expData = await expResponse.json();
        const recData = await recResponse.json();

        state.experiments = expData.experiments || [];
        state.recommendations = recData.recommendations || [];
        state.isLoading = false;

        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Unable to load data. Make sure the JSON files are in the data/ folder.');
    }
}

function showError(message) {
    const containers = ['recommendations-list', 'experiments-tbody'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">⚠</div>
                <p>${message}</p>
            </div>`;
        }
    });
}

// =============================================================================
// UI Updates
// =============================================================================

function updateUI() {
    updateStats();
    updateRecommendations();
    updateExperimentsTable();
    updateBadges();
}

function updateStats() {
    // Total experiments
    document.getElementById('total-experiments').textContent = state.experiments.length;

    // Pending recommendations
    const pending = state.recommendations.filter(r => r.status === 'pending');
    document.getElementById('pending-count').textContent = pending.length;

    // Completed recommendations
    const completed = state.recommendations.filter(r => r.status === 'completed');
    document.getElementById('completed-count').textContent = completed.length;

    // Model sources breakdown
    const sources = {
        imported: state.experiments.filter(e => e.source === 'imported').length,
        recommendation: state.experiments.filter(e => e.source === 'recommendation').length,
        manual: state.experiments.filter(e => e.source === 'manual').length
    };
    document.getElementById('model-accuracy').textContent = 
        `${sources.imported}/${sources.recommendation}/${sources.manual}`;
}

function updateBadges() {
    const counts = {
        pending: state.recommendations.filter(r => r.status === 'pending').length,
        completed: state.recommendations.filter(r => r.status === 'completed').length,
        skipped: state.recommendations.filter(r => r.status === 'skipped').length
    };

    document.getElementById('pending-badge').textContent = counts.pending;
    document.getElementById('completed-badge').textContent = counts.completed;
    document.getElementById('skipped-badge').textContent = counts.skipped;
}

// =============================================================================
// Recommendations Display
// =============================================================================

function updateRecommendations() {
    const container = document.getElementById('recommendations-list');
    
    let filtered = state.recommendations;
    if (state.currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === state.currentFilter);
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◇</div>
                <p>No ${state.currentFilter === 'all' ? '' : state.currentFilter} recommendations found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(rec => createRecommendationCard(rec)).join('');
}

function createRecommendationCard(rec) {
    const conditions = rec.conditions || {};
    const predictions = rec.predictions || {};
    const target = rec.target || {};
    
    const formatNum = (n, decimals = 2) => {
        if (n === null || n === undefined) return '--';
        return Number(n).toFixed(decimals);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '--';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const skipInfo = rec.skip_reason ? 
        `<div class="rec-skip-reason" style="margin-top: var(--space-sm); font-size: 0.85rem; color: var(--text-muted);">
            Skip reason: ${rec.skip_reason}
        </div>` : '';

    return `
        <div class="recommendation-card" data-status="${rec.status}">
            <div class="rec-header">
                <div>
                    <div class="rec-id">${rec.rec_id}</div>
                    <div class="rec-target">
                        Target Size: <span class="rec-target-value">${formatNum(target.size, 1)} ± ${formatNum(target.tolerance, 1)} nm</span>
                    </div>
                </div>
                <span class="status-badge ${rec.status}">${rec.status}</span>
            </div>
            
            <div class="rec-conditions">
                <div class="condition-item">
                    <div class="condition-label">Temp</div>
                    <div class="condition-value">${formatNum(conditions.Temp, 1)}°C</div>
                </div>
                <div class="condition-item">
                    <div class="condition-label">Time</div>
                    <div class="condition-value">${formatNum(conditions.Time, 1)} min</div>
                </div>
                <div class="condition-item">
                    <div class="condition-label">V(acac)₃</div>
                    <div class="condition-value">${formatNum(conditions.VOacac, 2)} mmol</div>
                </div>
                <div class="condition-item">
                    <div class="condition-label">DDT</div>
                    <div class="condition-value">${formatNum(conditions.DDT, 2)} mL</div>
                </div>
                <div class="condition-item">
                    <div class="condition-label">OAm</div>
                    <div class="condition-value">${formatNum(conditions.OAm, 2)} mL</div>
                </div>
            </div>

            <div class="rec-predictions">
                <div class="prediction-item">
                    <span class="prediction-label">Predicted Size</span>
                    <span class="prediction-value">${formatNum(predictions.size_mu, 1)} ± ${formatNum(predictions.size_std, 1)} nm</span>
                </div>
                <div class="prediction-item">
                    <span class="prediction-label">GSD</span>
                    <span class="prediction-value">${formatNum(predictions.gsd_mu, 3)} ± ${formatNum(predictions.gsd_std, 3)}</span>
                </div>
                <div class="prediction-item">
                    <span class="prediction-label">Squareness</span>
                    <span class="prediction-value">${formatNum(predictions.sq_mu, 3)} ± ${formatNum(predictions.sq_std, 3)}</span>
                </div>
                <div class="prediction-item">
                    <span class="prediction-label">P(Feasible)</span>
                    <span class="prediction-value">${formatNum(predictions.p_feasible * 100, 1)}%</span>
                </div>
            </div>
            
            ${skipInfo}
            
            <div class="rec-timestamp">
                Created: ${formatDate(rec.timestamp)}
                ${rec.completed_timestamp ? `<br>Completed: ${formatDate(rec.completed_timestamp)}` : ''}
            </div>
        </div>
    `;
}

// =============================================================================
// Experiments Table
// =============================================================================

function updateExperimentsTable() {
    const tbody = document.getElementById('experiments-tbody');
    
    let filtered = state.experiments;
    if (state.currentSource !== 'all') {
        filtered = filtered.filter(e => e.source === state.currentSource);
    }

    // Sort by experiment ID
    filtered.sort((a, b) => {
        const numA = parseInt(a.exp_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.exp_id.replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    No experiments found for the selected source.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(exp => createExperimentRow(exp)).join('');
}

function createExperimentRow(exp) {
    const formatNum = (n, decimals = 2) => {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return Number(n).toFixed(decimals);
    };

    const sourceClass = exp.source || 'imported';
    
    return `
        <tr>
            <td>${exp.exp_id}</td>
            <td class="numeric">${formatNum(exp.Temp, 0)}</td>
            <td class="numeric">${formatNum(exp.Time, 1)}</td>
            <td class="numeric">${formatNum(exp.VOacac, 2)}</td>
            <td class="numeric">${formatNum(exp.DDT, 2)}</td>
            <td class="numeric">${formatNum(exp.OAm, 2)}</td>
            <td class="numeric">${formatNum(exp.Size, 1)}</td>
            <td class="numeric">${formatNum(exp.GSD, 3)}</td>
            <td class="numeric">${formatNum(exp.Squareness, 3)}</td>
            <td><span class="source-tag ${sourceClass}">${sourceClass}</span></td>
        </tr>
    `;
}

// =============================================================================
// Event Handlers
// =============================================================================

function setupEventListeners() {
    // Recommendation filter tabs
    document.querySelectorAll('.filter-tab[data-filter]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab[data-filter]').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            state.currentFilter = e.target.dataset.filter;
            updateRecommendations();
        });
    });

    // Experiment source filter tabs
    document.querySelectorAll('.filter-tab[data-source]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab[data-source]').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            state.currentSource = e.target.dataset.source;
            updateExperimentsTable();
        });
    });

    // Prediction form
    const predictForm = document.getElementById('predict-form');
    if (predictForm) {
        predictForm.addEventListener('submit', handlePredictForm);
        predictForm.addEventListener('input', updateNotebookCode);
    }

    // Copy code button
    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyNotebookCode);
    }

    // Navigation smooth scroll
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function handlePredictForm(e) {
    e.preventDefault();
    updateNotebookCode();
    copyNotebookCode();
}

function updateNotebookCode() {
    const form = document.getElementById('predict-form');
    const codeBlock = document.getElementById('notebook-code');
    
    const temp = form.querySelector('[name="Temp"]').value;
    const time = form.querySelector('[name="Time"]').value;
    const voacac = form.querySelector('[name="VOacac"]').value;
    const ddt = form.querySelector('[name="DDT"]').value;
    const oam = form.querySelector('[name="OAm"]').value;

    codeBlock.textContent = `# Run this in your Cu3VS4_SelfValidating_BO.ipynb notebook
# Make sure to initialize the optimizer first!

optimizer.predict_from_conditions(
    Temp=${temp},
    Time=${time},
    VOacac=${voacac},
    DDT=${ddt},
    OAm=${oam}
)`;
}

async function copyNotebookCode() {
    const codeBlock = document.getElementById('notebook-code');
    const copyBtn = document.getElementById('copy-code-btn');
    
    try {
        await navigator.clipboard.writeText(codeBlock.textContent);
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="btn-icon">✓</span> Copied!';
        copyBtn.style.background = 'var(--status-completed)';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard. Please select and copy manually.');
    }
}

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadData();

    // Optional: Auto-refresh
    if (CONFIG.refreshInterval) {
        setInterval(loadData, CONFIG.refreshInterval);
    }
});

// Initial code block update
window.addEventListener('load', () => {
    updateNotebookCode();
});
