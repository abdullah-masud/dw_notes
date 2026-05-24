(function () {
    const config = window.DATA_WAREHOUSE_NOTES_CONFIG || {};
    const storagePrefix = 'data-warehouse-notes:';
    const sharedSpace = config.sharedSpace || 'data-warehouse-shared';
    const supabaseUrl = config.supabaseUrl || '';
    const supabaseAnonKey = config.supabaseAnonKey || '';
    const savedLabel = 'Saved locally';
    const typingLabel = 'Saving...';
    const remoteTimers = {};
    let syncEnabled = Boolean(supabaseUrl && supabaseAnonKey);
    let syncStatus;

    function storageKey(localNoteKey) {
        return storagePrefix + localNoteKey;
    }

    function setSyncStatus(message) {
        if (syncStatus) {
            syncStatus.textContent = message;
        }
    }

    function remoteId(localNoteKey) {
        return sharedSpace + '|' + localNoteKey;
    }

    async function supabaseRequest(path, options) {
        if (!syncEnabled) {
            throw new Error('Supabase sync is not configured.');
        }

        const requestOptions = options || {};
        const response = await fetch(supabaseUrl + '/rest/v1/' + path, Object.assign({}, requestOptions, {
            headers: Object.assign({
                apikey: supabaseAnonKey,
                Authorization: 'Bearer ' + supabaseAnonKey,
                'Content-Type': 'application/json'
            }, requestOptions.headers || {})
        }));

        if (!response.ok) {
            throw new Error(await response.text());
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    function saveRemote(localNoteKey, content, status) {
        if (!syncEnabled) {
            return;
        }

        status.textContent = 'Cloud saving...';
        clearTimeout(remoteTimers[localNoteKey]);
        remoteTimers[localNoteKey] = setTimeout(async function () {
            try {
                await supabaseRequest('study_notes?on_conflict=id', {
                    method: 'POST',
                    headers: {
                        Prefer: 'resolution=merge-duplicates,return=minimal'
                    },
                    body: JSON.stringify([{
                        id: remoteId(localNoteKey),
                        passcode: sharedSpace,
                        content: content,
                        updated_at: new Date().toISOString()
                    }])
                });
                status.textContent = 'Saved to cloud';
                setSyncStatus('Synced');
            } catch (error) {
                console.error(error);
                status.textContent = 'Cloud save failed';
                setSyncStatus('Sync error');
            }
        }, 550);
    }

    async function loadRemoteNotes() {
        if (!syncEnabled) {
            setSyncStatus('Local only');
            return;
        }

        setSyncStatus('Loading...');

        try {
            const rows = await supabaseRequest('study_notes?select=id,content&passcode=eq.' + encodeURIComponent(sharedSpace));
            const remoteNotes = new Map((rows || []).map(function (row) {
                return [row.id.replace(sharedSpace + '|', ''), row.content || ''];
            }));

            document.querySelectorAll('.study-note').forEach(function (note) {
                const localNoteKey = note.dataset.noteKey;
                const textarea = note.querySelector('textarea');
                const status = note.querySelector('.study-note-status');
                const button = document.querySelector('[data-note-toggle="' + attrEscape(localNoteKey) + '"]');
                const remoteContent = remoteNotes.get(localNoteKey);

                if (remoteContent !== undefined) {
                    textarea.value = remoteContent;
                    localStorage.setItem(storageKey(localNoteKey), remoteContent);
                    note.classList.toggle('open', Boolean(remoteContent.trim()));
                } else if (textarea.value.trim()) {
                    saveRemote(localNoteKey, textarea.value, status);
                }

                if (button) {
                    button.textContent = textarea.value.trim() ? 'Close Note' : 'Note';
                }
                status.textContent = textarea.value.trim() ? 'Saved to cloud' : savedLabel;
            });

            setSyncStatus('Synced');
        } catch (error) {
            console.error(error);
            setSyncStatus('Sync failed');
        }
    }

    async function clearRemoteNotes() {
        if (!syncEnabled) {
            return;
        }

        await supabaseRequest('study_notes?passcode=eq.' + encodeURIComponent(sharedSpace), {
            method: 'DELETE',
            headers: {
                Prefer: 'return=minimal'
            }
        });
    }

    function attrEscape(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function slug(text, fallback) {
        return (text || fallback)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || fallback;
    }

    function pageId() {
        const file = window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
        return slug(file.replace(/\.html?$/i, ''), 'page');
    }

    function makeNoteBox(localNoteKey, title, placeholder) {
        const note = document.createElement('div');
        note.className = 'study-note collapsible';
        note.dataset.noteKey = localNoteKey;

        const header = document.createElement('div');
        header.className = 'study-note-header';

        const label = document.createElement('div');
        label.className = 'study-note-title';
        label.textContent = title;

        const status = document.createElement('div');
        status.className = 'study-note-status';
        status.textContent = savedLabel;

        const textarea = document.createElement('textarea');
        textarea.value = localStorage.getItem(storageKey(localNoteKey)) || '';
        textarea.placeholder = placeholder;
        textarea.setAttribute('aria-label', title);

        let timer;
        textarea.addEventListener('input', function () {
            status.textContent = typingLabel;
            clearTimeout(timer);
            timer = setTimeout(function () {
                localStorage.setItem(storageKey(localNoteKey), textarea.value);
                status.textContent = savedLabel;
                saveRemote(localNoteKey, textarea.value, status);
            }, 250);
        });

        header.append(label, status);
        note.append(header, textarea);

        if (textarea.value.trim()) {
            note.classList.add('open');
            status.textContent = 'Saved locally';
        }

        return note;
    }

    function makeToggleButton(localNoteKey) {
        const button = document.createElement('button');
        button.className = 'topic-note-toggle';
        button.type = 'button';
        button.dataset.noteToggle = localNoteKey;
        button.textContent = localStorage.getItem(storageKey(localNoteKey)) ? 'Close Note' : 'Note';
        return button;
    }

    function connectToggle(button, note) {
        const textarea = note.querySelector('textarea');

        button.addEventListener('click', function () {
            note.classList.toggle('open');
            button.textContent = note.classList.contains('open') ? 'Close Note' : 'Note';
            if (note.classList.contains('open')) {
                textarea.focus();
            }
        });

        textarea.addEventListener('input', function () {
            if (textarea.value.trim()) {
                button.textContent = note.classList.contains('open') ? 'Close Note' : 'Note';
            }
        });
    }

    function addNoteAfterHeading(heading, insertAfter, localNoteKey, label, placeholder) {
        if (!heading || document.querySelector('[data-note-toggle="' + attrEscape(localNoteKey) + '"]')) {
            return;
        }

        const button = makeToggleButton(localNoteKey);
        const note = makeNoteBox(localNoteKey, label, placeholder);
        heading.appendChild(button);
        insertAfter.insertAdjacentElement('afterend', note);
        connectToggle(button, note);
    }

    function initialiseNotes() {
        const idBase = pageId();
        const content = document.querySelector('.content');

        if (content) {
            const lectureHeading = document.querySelector('.hero h1');
            if (lectureHeading) {
                addNoteAfterHeading(
                    lectureHeading,
                    lectureHeading,
                    idBase + ':lecture:' + slug(lectureHeading.textContent, 'lecture'),
                    'Lecture note',
                    'Type your study notes for this lecture. They autosave in this browser and sync to the shared cloud space.'
                );
            }

            content.querySelectorAll('.section').forEach(function (section, index) {
                const header = section.querySelector(':scope > .section-header');
                const heading = header ? header.querySelector('h2') : null;
                const stableId = section.id || slug(heading ? heading.textContent : '', 'section-' + index);

                if (heading && header) {
                    addNoteAfterHeading(
                        heading,
                        header,
                        idBase + ':section:' + stableId,
                        'Section note',
                        'Add notes for this section.'
                    );
                }
            });

            content.querySelectorAll('h3').forEach(function (heading, index) {
                if (heading.closest('.study-note, .summary-box, .quiz-item')) {
                    return;
                }

                const section = heading.closest('.section');
                const sectionId = section ? (section.id || slug(section.textContent, 'section')) : 'general';
                const topicId = heading.id || slug(heading.textContent, 'topic-' + index);

                addNoteAfterHeading(
                    heading,
                    heading,
                    idBase + ':topic:' + sectionId + ':' + topicId,
                    'Topic note',
                    'Add a quick note for this topic.'
                );
            });
        }

        createTools();
        loadRemoteNotes();
    }

    function createTools() {
        if (document.querySelector('.notes-tools')) {
            return;
        }

        const tools = document.createElement('div');
        tools.className = 'notes-tools';

        const refreshButton = document.createElement('button');
        refreshButton.type = 'button';
        refreshButton.textContent = 'Refresh notes';
        refreshButton.addEventListener('click', loadRemoteNotes);

        syncStatus = document.createElement('span');
        syncStatus.className = 'sync-status';
        syncStatus.textContent = syncEnabled ? 'Loading...' : 'Local only';

        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.textContent = 'Export notes';
        exportButton.addEventListener('click', function () {
            const notes = {};
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith(storagePrefix)) {
                    notes[key.replace(storagePrefix, '')] = localStorage.getItem(key);
                }
            }

            const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'data-warehouse-study-notes.json';
            link.click();
            URL.revokeObjectURL(link.href);
        });

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.textContent = 'Clear notes';
        clearButton.addEventListener('click', async function () {
            if (!confirm('Clear all saved study notes from this browser and the shared cloud space?')) {
                return;
            }

            setSyncStatus('Clearing...');
            Object.keys(remoteTimers).forEach(function (key) {
                clearTimeout(remoteTimers[key]);
            });

            for (let i = localStorage.length - 1; i >= 0; i -= 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith(storagePrefix)) {
                    localStorage.removeItem(key);
                }
            }

            document.querySelectorAll('.study-note').forEach(function (note) {
                note.classList.remove('open');
                note.querySelector('textarea').value = '';
                note.querySelector('.study-note-status').textContent = savedLabel;
            });
            document.querySelectorAll('.topic-note-toggle').forEach(function (button) {
                button.textContent = 'Note';
            });

            try {
                await clearRemoteNotes();
                setSyncStatus(syncEnabled ? 'Cleared' : 'Local only');
            } catch (error) {
                console.error(error);
                setSyncStatus('Cloud clear failed');
            }
        });

        tools.append(refreshButton, syncStatus, exportButton, clearButton);
        document.body.appendChild(tools);
    }

    function initialiseNavObserver() {
        const sections = document.querySelectorAll('[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        if (!sections.length || !navLinks.length || !('IntersectionObserver' in window)) {
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    navLinks.forEach(function (link) {
                        link.classList.remove('active');
                    });
                    const active = document.querySelector('.nav-link[href="' + attrEscape('#' + entry.target.id) + '"]');
                    if (active) {
                        active.classList.add('active');
                    }
                }
            });
        }, { rootMargin: '-30% 0px -60% 0px' });

        sections.forEach(function (section) {
            observer.observe(section);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initialiseNavObserver();
        initialiseNotes();
    });
}());
