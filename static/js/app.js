// App state
let state = {
    updates: [],
    selectedIds: new Set(),
    activeFilter: 'all',
    searchQuery: '',
    lastFetched: null
};

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const lastUpdatedText = document.getElementById('last-updated-text');
const searchInput = document.getElementById('search-input');
const filterTabs = document.getElementById('filter-tabs');
const releaseGrid = document.getElementById('release-grid');
const floatingBar = document.getElementById('floating-bar');
const selectionCountBadge = document.getElementById('selection-count-badge');
const tweetComposerTriggerBtn = document.getElementById('tweet-composer-trigger-btn');
const selectAllBtn = document.getElementById('select-all-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const notificationBanner = document.getElementById('notification-banner');
const notificationMsg = document.getElementById('notification-msg');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const progressCircle = document.getElementById('progress-circle');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const submitTweetBtn = document.getElementById('submit-tweet-btn');
const previewUpdatesList = document.getElementById('preview-updates-list');
const presetChips = document.querySelector('.preset-chips');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Event Listeners setup
function setupEventListeners() {
    // Refresh Button
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));

    // Search input
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderUpdates();
    });

    // Filter tabs
    filterTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab');
        if (!tab) return;
        
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilter = tab.dataset.type;
        renderUpdates();
    });

    // Bulk actions
    selectAllBtn.addEventListener('click', selectVisiblePage);
    clearSelectionBtn.addEventListener('click', clearAllSelection);

    // Card grid selection click
    releaseGrid.addEventListener('click', handleCardClick);

    // Floating bar trigger
    tweetComposerTriggerBtn.addEventListener('click', openTweetComposer);

    // Modal closing
    modalCloseBtn.addEventListener('click', closeTweetComposer);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetComposer();
    });

    // Tweet text change
    tweetTextarea.addEventListener('input', updateCharCount);

    // Preset chips actions
    presetChips.addEventListener('click', handlePresetClick);

    // Copy and Post buttons
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    submitTweetBtn.addEventListener('click', submitTweetToX);
}

// Fetch Release Notes
async function fetchReleaseNotes(force = false) {
    setLoadingState(true);
    showNotification(null); // Hide any old notification
    
    try {
        const url = `/api/release-notes${force ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'warning') {
            showNotification(data.message);
        }
        
        // Map updates to include a clean type index
        state.updates = data.updates.map((update, index) => {
            // Determine type categories
            let typeLower = update.type.toLowerCase();
            let category = 'other';
            if (typeLower.includes('feature')) category = 'feature';
            else if (typeLower.includes('issue') || typeLower.includes('bug')) category = 'issue';
            
            return {
                ...update,
                id: index,
                category: category
            };
        });
        
        state.lastFetched = new Date(data.last_fetched);
        updateLastFetchedTimestamp();
        
        // Render counts and updates
        updateFilterBadges();
        renderUpdates();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showNotification(`Failed to load release notes. Error: ${error.message}`);
        
        // Clear grid if we don't have cached data
        if (state.updates.length === 0) {
            releaseGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation empty-state-icon"></i>
                    <h3>Unable to fetch release notes</h3>
                    <p>We couldn't connect to the Google Cloud release notes feed. Please verify your connection or click Refresh to try again.</p>
                </div>
            `;
        }
    } finally {
        setLoadingState(false);
    }
}

// Set Loading UI state
function setLoadingState(isLoading) {
    if (isLoading) {
        refreshIcon.classList.add('spin');
        refreshBtn.disabled = true;
        document.querySelector('.status-dot').className = 'status-dot loading';
        lastUpdatedText.textContent = "Syncing feed...";
        
        // If grid is empty, show loading skeletons
        if (state.updates.length === 0) {
            releaseGrid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
        }
    } else {
        refreshIcon.classList.remove('spin');
        refreshBtn.disabled = false;
        document.querySelector('.status-dot').className = 'status-dot green';
    }
}

// Update Last Fetched Label
function updateLastFetchedTimestamp() {
    if (!state.lastFetched) return;
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    });
    lastUpdatedText.textContent = `Sync completed at ${formatter.format(state.lastFetched)}`;
}

// Show/Hide top notification
function showNotification(msg) {
    if (msg) {
        notificationMsg.textContent = msg;
        notificationBanner.classList.remove('hide');
    } else {
        notificationBanner.classList.add('hide');
    }
}

// Get filtered updates based on state
function getFilteredUpdates() {
    return state.updates.filter(update => {
        // Filter by category
        if (state.activeFilter !== 'all' && update.category !== state.activeFilter) {
            return false;
        }
        
        // Filter by search query
        if (state.searchQuery) {
            const contentClean = stripHtml(update.content).toLowerCase();
            const typeClean = update.type.toLowerCase();
            const dateClean = update.date.toLowerCase();
            return contentClean.includes(state.searchQuery) || 
                   typeClean.includes(state.searchQuery) || 
                   dateClean.includes(state.searchQuery);
        }
        
        return true;
    });
}

// Update badges on the filter buttons
function updateFilterBadges() {
    const counts = { all: 0, feature: 0, issue: 0, other: 0 };
    
    state.updates.forEach(update => {
        counts.all++;
        if (counts.hasOwnProperty(update.category)) {
            counts[update.category]++;
        } else {
            counts.other++;
        }
    });
    
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-feature').textContent = counts.feature;
    document.getElementById('count-issue').textContent = counts.issue;
    document.getElementById('count-other').textContent = counts.other;
}

// Render release notes grid
function renderUpdates() {
    const filtered = getFilteredUpdates();
    
    if (filtered.length === 0) {
        releaseGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass empty-state-icon"></i>
                <h3>No updates found</h3>
                <p>Try resetting filters or searching for another keyword.</p>
            </div>
        `;
        updateBulkActionsState();
        return;
    }
    
    releaseGrid.innerHTML = filtered.map(update => {
        const isSelected = state.selectedIds.has(update.id);
        const cardClass = isSelected ? 'release-card selected' : 'release-card';
        const checkIcon = isSelected ? '<i class="fa-solid fa-check"></i>' : '';
        
        return `
            <div class="release-card" data-id="${update.id}">
                <div class="card-top">
                    <div class="card-meta">
                        <span class="card-type-badge ${update.category}">${update.type}</span>
                        <span class="card-date">${update.date}</span>
                    </div>
                    <div class="card-select-wrapper">
                        <div class="custom-checkbox">${checkIcon}</div>
                    </div>
                </div>
                
                <div class="card-body">
                    ${update.content}
                </div>
                
                <div class="card-footer">
                    <button class="card-action-btn copy-link-btn" data-link="${update.link}" title="Copy Link">
                        <i class="fa-regular fa-copy"></i> Copy Link
                    </button>
                    <button class="card-action-btn share-btn" data-id="${update.id}" title="Quick Share">
                        <i class="fa-brands fa-x-twitter"></i> Share
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    updateBulkActionsState();
}

// Handle clicking on cards
function handleCardClick(e) {
    const card = e.target.closest('.release-card');
    if (!card) return;
    
    const updateId = parseInt(card.dataset.id, 10);
    const update = state.updates.find(u => u.id === updateId);
    
    // Check if user clicked a link inside the card body
    if (e.target.closest('.card-body a')) {
        // Let link click navigate normally
        return;
    }
    
    // Check if user clicked the "Copy Link" action button
    const copyBtn = e.target.closest('.copy-link-btn');
    if (copyBtn) {
        e.stopPropagation();
        const link = copyBtn.dataset.link;
        copyTextToClipboardHelper(link);
        showTemporaryButtonText(copyBtn, '<i class="fa-solid fa-check"></i> Copied!');
        return;
    }
    
    // Check if user clicked the quick share button
    const shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
        e.stopPropagation();
        quickShareSingle(updateId);
        return;
    }
    
    // Toggle selection
    toggleSelection(updateId);
}

// Toggle update selection
function toggleSelection(id) {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
    } else {
        state.selectedIds.add(id);
    }
    
    // Re-render only selection state of cards to prevent full reload
    document.querySelectorAll('.release-card').forEach(card => {
        const cardId = parseInt(card.dataset.id, 10);
        const checkbox = card.querySelector('.custom-checkbox');
        if (state.selectedIds.has(cardId)) {
            card.classList.add('selected');
            checkbox.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
            card.classList.remove('selected');
            checkbox.innerHTML = '';
        }
    });
    
    updateFloatingBar();
    updateBulkActionsState();
}

// Select all visible cards
function selectVisiblePage() {
    const filtered = getFilteredUpdates();
    filtered.forEach(update => {
        state.selectedIds.add(update.id);
    });
    renderUpdates();
    updateFloatingBar();
}

// Clear all selection
function clearAllSelection() {
    state.selectedIds.clear();
    renderUpdates();
    updateFloatingBar();
}

// Update bulk actions buttons state
function updateBulkActionsState() {
    clearSelectionBtn.disabled = state.selectedIds.size === 0;
}

// Update floating selection bar
function updateFloatingBar() {
    const count = state.selectedIds.size;
    if (count > 0) {
        selectionCountBadge.textContent = count;
        floatingBar.classList.add('show');
    } else {
        floatingBar.classList.remove('show');
    }
}

// Open Tweet Composer Modal
function openTweetComposer() {
    tweetModal.classList.add('show');
    compileTweetDraft();
    updateCharCount();
}

// Close Tweet Composer Modal
function closeTweetComposer() {
    tweetModal.classList.remove('show');
}

// Compile Draft text based on selected updates
function compileTweetDraft(style = 'standard') {
    const selectedUpdates = Array.from(state.selectedIds).map(id => state.updates.find(u => u.id === id));
    
    // Sort selected updates by date/index descending
    selectedUpdates.sort((a, b) => b.id - a.id);
    
    let draft = "";
    
    if (selectedUpdates.length === 1) {
        const u = selectedUpdates[0];
        const plainText = stripHtml(u.content);
        const truncatedContent = truncateText(plainText, 140);
        
        if (style === 'standard') {
            draft = `📢 [${u.type}] BigQuery Release (${u.date}):\n${truncatedContent}\n\nRead details: ${u.link}\n#BigQuery #GoogleCloud`;
        } else { // summary style
            draft = `💡 BigQuery Update (${u.date})\nType: ${u.type}\n📌 ${truncatedContent}\n\nLink: ${u.link}`;
        }
    } else if (selectedUpdates.length > 1) {
        // Multi-selection list
        if (style === 'standard') {
            draft = `📢 Latest BigQuery Releases:\n`;
            selectedUpdates.forEach(u => {
                const plainText = stripHtml(u.content);
                const summaryLine = truncateText(plainText, 50);
                draft += `• [${u.type}] ${summaryLine} (${u.date})\n`;
            });
            draft += `\nRead all: https://docs.cloud.google.com/bigquery/docs/release-notes\n#BigQuery #GCP`;
        } else { // summary style
            draft = `🚀 BigQuery Updates list:\n`;
            selectedUpdates.forEach(u => {
                const plainText = stripHtml(u.content);
                const summaryLine = truncateText(plainText, 45);
                draft += `👉 ${u.type}: ${summaryLine}\n`;
            });
            draft += `\n🌐 docs.cloud.google.com/bigquery/docs/release-notes`;
        }
    }
    
    tweetTextarea.value = draft;
    renderSelectedPreviewList(selectedUpdates);
}

// Render dynamic list of selected updates inside the composer modal
function renderSelectedPreviewList(selectedUpdates) {
    previewUpdatesList.innerHTML = selectedUpdates.map(u => `
        <div class="preview-update-item">
            <i class="fa-solid fa-circle-check"></i>
            <span><strong>[${u.type}]</strong> ${u.date} - ${truncateText(stripHtml(u.content), 60)}</span>
        </div>
    `).join('');
}

// Open modal for quick sharing a single card
function quickShareSingle(id) {
    state.selectedIds.clear();
    state.selectedIds.add(id);
    updateFloatingBar();
    updateBulkActionsState();
    
    // Trigger card styling updates
    document.querySelectorAll('.release-card').forEach(card => {
        const cardId = parseInt(card.dataset.id, 10);
        const checkbox = card.querySelector('.custom-checkbox');
        if (state.selectedIds.has(cardId)) {
            card.classList.add('selected');
            checkbox.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
            card.classList.remove('selected');
            checkbox.innerHTML = '';
        }
    });

    openTweetComposer();
}

// Update Character count and circular progress indicator
function updateCharCount() {
    const text = tweetTextarea.value;
    const len = text.length;
    const limit = 280;
    
    charCounter.textContent = `${len} / ${limit}`;
    
    // Warning and Danger States
    const wrapper = document.querySelector('.char-count-wrapper');
    if (len > limit) {
        wrapper.className = 'char-count-wrapper danger';
        submitTweetBtn.disabled = true;
    } else if (len > 240) {
        wrapper.className = 'char-count-wrapper warning';
        submitTweetBtn.disabled = false;
    } else {
        wrapper.className = 'char-count-wrapper';
        submitTweetBtn.disabled = false;
    }
    
    // Progress Circle animation (dashoffset calculation)
    const radius = 9;
    const circumference = 2 * Math.PI * radius; // 56.548
    const percentage = Math.min(len / limit, 1);
    const dashoffset = circumference - (percentage * circumference);
    
    progressCircle.style.strokeDashoffset = dashoffset;
}

// Preset Action Clicks (Chips)
function handlePresetClick(e) {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;
    
    const action = chip.dataset.action;
    const val = chip.dataset.value;
    
    if (action === 'hashtag') {
        const text = tweetTextarea.value;
        if (!text.includes(val)) {
            tweetTextarea.value = text.trim() + " " + val;
            updateCharCount();
        }
    } else if (action === 'template') {
        if (val === 'reset') {
            compileTweetDraft('standard');
        } else {
            compileTweetDraft(val);
        }
        updateCharCount();
    }
}

// Copy Tweet Text
function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    copyTextToClipboardHelper(text);
    
    showTemporaryButtonText(copyTweetBtn, '<i class="fa-solid fa-check"></i> Copied!');
}

// Submit tweet to Twitter (Web Intent)
function submitTweetToX() {
    const text = tweetTextarea.value;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// Helper: Strip HTML tags to produce plain text
function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

// Helper: Truncate string with ellipsis
function truncateText(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + "...";
}

// Helper: Clipboard copy
function copyTextToClipboardHelper(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Copy fallback failed', err);
        }
        document.body.removeChild(textarea);
    }
}

// Helper: Temporarily change button HTML text on click
function showTemporaryButtonText(btn, tempHtml, delay = 2000) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = tempHtml;
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }, delay);
}
