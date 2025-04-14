
document.addEventListener('DOMContentLoaded', () => {
    const fornitoriList = document.getElementById('fornitori-list');
    const rotteBody = document.getElementById('rotte-body');
    const timelineHead = document.getElementById('timeline-head');
    const timelineBody = document.getElementById('timeline-body');

    let datiPuliti = [];
    let giorniTimeline = []; // Array di oggetti con { date, year, month, day }

    const priorityColors = {
        1: '#8B0000',   // Dark Red
        2: '#A52A2A',   // Brown
        3: '#B22222',   // Firebrick
        4: '#CD5C5C',   // Indian Red
        5: '#D2691E',   // Chocolate
        6: '#DAA520',   // Goldenrod
        7: '#BDB76B',   // Dark Khaki
        8: '#6B8E23',   // Olive Drab
        9: '#2E8B57',   // Sea Green
        10: '#4682B4',  // Steel Blue
        11: '#5F9EA0',  // Cadet Blue
        12: '#708090',  // Slate Gray
        13: '#778899',  // Light Slate Gray
        14: '#6A5ACD',  // Slate Blue
        15: '#483D8B'   // Dark Slate Blue
    };


    function parsePriority(priorityString) {
        if (!priorityString) return Infinity;
        const numbers = priorityString.match(/\d+/g);
        return numbers ? parseInt(numbers[numbers.length - 1], 10) : Infinity;
    }

    function parseDate(itDate) {
        const [day, month, year] = itDate.split('/').map(Number);
        return new Date(year, month - 1, day);
    }

    function formatMonth(date) {
        return date.toLocaleString('default', { month: 'long' }) + ' ' + date.getFullYear();
    }

    function getTimelineRange(data) {
        let minDate = null, maxDate = null;
        data.forEach(item => {
            const start = parseDate(item.Data_DA);
            const end = parseDate(item.Data_A);
            if (!minDate || start < minDate) minDate = start;
            if (!maxDate || end > maxDate) maxDate = end;
        });

        giorniTimeline = [];
        const current = new Date(minDate);
        while (current <= maxDate) {
            giorniTimeline.push({
                date: new Date(current),
                year: current.getFullYear(),
                month: current.getMonth(),
                day: current.getDate()
            });
            current.setDate(current.getDate() + 1);
        }
    }

    function generateTimelineHeader() {
        timelineHead.innerHTML = '';
        const headerRow1 = document.createElement('tr');
        const headerRow2 = document.createElement('tr');

        headerRow1.innerHTML = `<th scope="col" rowspan="2">Versioni (Orario)</th>`;
        let lastMonth = '';
        let colCount = 0;

        giorniTimeline.forEach((g, i) => {
            const thisMonth = `${g.month}-${g.year}`;
            if (thisMonth !== lastMonth) {
                if (colCount > 0) {
                    headerRow1.innerHTML += `<th colspan="${colCount}">${formatMonth(giorniTimeline[i - 1].date)}</th>`;
                }
                colCount = 1;
                lastMonth = thisMonth;
            } else {
                colCount++;
            }
            headerRow2.innerHTML += `<th>${g.day}</th>`;
        });

        // Ultimo mese
        if (colCount > 0) {
            headerRow1.innerHTML += `<th colspan="${colCount}">${formatMonth(giorniTimeline[giorniTimeline.length - 1].date)}</th>`;
        }

        timelineHead.appendChild(headerRow1);
        timelineHead.appendChild(headerRow2);
    }

    function cleanData(rawData) {
        return rawData.map(item => {
            const cleaned = { ...item };

            if (item.Linea_1 && item.Linea_1.includes(' ')) {
                const parts = item.Linea_1.split(' ');
                if (/^[A-Z]+\d+/i.test(parts[0])) {
                    cleaned.Linea_1 = parts[0];
                    if (!item.Linea_2 || item.Linea_2 === item.Linea_1) {
                        cleaned.Linea_2 = parts[0];
                    }
                    if (item.Linea_2 && item.Linea_2.includes('TI')) {
                        cleaned.Versione_Orario = item.Linea_2;
                    }
                }
            } else if (item.Linea_1 && item.Linea_1.includes('TI')) {
                cleaned.Versione_Orario = item.Linea_1;
                if (item.Priorita && /^[A-Z]+\d+/i.test(item.Priorita)) {
                    const parts = item.Priorita.split(' ');
                    cleaned.Linea_1 = parts[0];
                    cleaned.Linea_2 = parts[1] || parts[0];
                } else {
                    cleaned.Linea_1 = cleaned.Linea_2 = 'UNKNOWN';
                }
            }

            if (cleaned.Linea_2 && cleaned.Linea_2.includes('TI')) {
                cleaned.Versione_Orario = cleaned.Linea_2;
                cleaned.Linea_2 = cleaned.Linea_1;
            }

            cleaned.PrioritaNum = parsePriority(item.Priorita);
            cleaned.Company = cleaned.Company || 'UNKNOWN';
            cleaned.Division_short = cleaned.Division_short || 'UNKNOWN';
            cleaned.Linea_1 = cleaned.Linea_1 || 'UNKNOWN';
            cleaned.Linea_2 = cleaned.Linea_2 || 'UNKNOWN';
            cleaned.Versione_Orario = cleaned.Versione_Orario || 'UNKNOWN';

            return cleaned;
        }).filter(item => item.Company !== 'UNKNOWN');
    }

    function loadFornitori() {
        fornitoriList.innerHTML = '';
        const fornitori = new Map();

        datiPuliti.forEach(item => {
            const key = `${item.Company}|${item.Division_short}`;
            if (!fornitori.has(key)) {
                fornitori.set(key, { company: item.Company, division: item.Division_short });
            }
        });

        if (fornitori.size === 0) {
            fornitoriList.innerHTML = '<div class="list-box-item"><span class="text-muted">Nessun fornitore trovato</span></div>';
            return;
        }

        fornitori.forEach(value => {
            const div = document.createElement('div');
            div.className = 'list-box-item';
            div.dataset.company = value.company;
            div.dataset.division = value.division;
            div.innerHTML = `
                <span>Fornitore</span>
                <span>${value.company}</span>
                <span>${value.division}</span>
            `;
            div.addEventListener('click', handleFornitoreClick);
            fornitoriList.appendChild(div);
        });
    }

    function loadRotte(company, division) {
        rotteBody.innerHTML = '';
        timelineBody.innerHTML = `<tr><td colspan="${giorniTimeline.length + 1}" class="text-center text-muted">Seleziona una rotta</td></tr>`;

        const rotte = new Map();
        datiPuliti.filter(i => i.Company === company && i.Division_short === division).forEach(i => {
            const key = `${i.Linea_1}|${i.Linea_2}|${i.Company}|${i.Division_short}`;
            if (!rotte.has(key) && i.Linea_1 !== 'UNKNOWN') {
                rotte.set(key, {
                    linea1: i.Linea_1,
                    linea2: i.Linea_2,
                    company: i.Company,
                    division: i.Division_short
                });
            }
        });

        if (rotte.size === 0) {
            rotteBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nessuna rotta trovata</td></tr>';
            return;
        }

        rotte.forEach(value => {
            const tr = document.createElement('tr');
            tr.dataset.linea1 = value.linea1;
            tr.dataset.linea2 = value.linea2;
            tr.dataset.company = value.company;
            tr.dataset.division = value.division;
            tr.innerHTML = `
                <td>${value.linea1}</td>
                <td>${value.linea2}</td>
                <td>${value.company}</td>
                <td>${value.division}</td>
            `;
            tr.addEventListener('click', handleRottaClick);
            rotteBody.appendChild(tr);
        });
    }

    function loadTimeline(company, division, linea1, linea2) {
        timelineBody.innerHTML = '';

        const versioni = datiPuliti
            .filter(i => i.Company === company && i.Division_short === division && i.Linea_1 === linea1 && i.Linea_2 === linea2)
            .sort((a, b) => a.PrioritaNum - b.PrioritaNum);

        if (versioni.length === 0) {
            timelineBody.innerHTML = `<tr><td colspan="${giorniTimeline.length + 1}" class="text-center text-muted">Nessuna versione trovata</td></tr>`;
            return;
        }

        versioni.forEach(v => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.scope = 'row';
            th.textContent = v.Versione_Orario || 'N/D';
            tr.appendChild(th);

            const start = parseDate(v.Data_DA);
            const end = parseDate(v.Data_A);

            let started = false;
            let span = 0;

            giorniTimeline.forEach((g, i) => {
                const d = g.date;

                if (d >= start && d <= end) {
                    if (!started) {
                        // Inizia nuova cella
                        started = true;
                        span = 1;
                    } else {
                        span++;
                    }

                    // Se siamo all’ultimo giorno o il giorno dopo non è più valido → chiudiamo cella
                    const next = giorniTimeline[i + 1]?.date;
                    if (!next || next > end) {
                        const td = document.createElement('td');
                        td.colSpan = span;
                        td.style.backgroundColor = priorityColors[v.PrioritaNum] || '#cccccc';
                        td.style.borderRadius = '4px';
                        td.style.height = '12px';
                        td.innerHTML = '&nbsp;';
                        tr.appendChild(td);
                    }
                } else if (!started) {
                    // Prima dell'intervallo → cella vuota
                    const td = document.createElement('td');
                    td.innerHTML = '&nbsp;';
                    tr.appendChild(td);
                }
            });

            timelineBody.appendChild(tr);
        });
    }


    function handleFornitoreClick(e) {
        fornitoriList.querySelectorAll('.list-box-item').forEach(i => i.classList.remove('active'));
        const div = e.currentTarget;
        div.classList.add('active');
        loadRotte(div.dataset.company, div.dataset.division);
    }

    function handleRottaClick(e) {
        rotteBody.querySelectorAll('tr').forEach(r => r.classList.remove('table-active'));
        const row = e.currentTarget;
        row.classList.add('table-active');
        loadTimeline(row.dataset.company, row.dataset.division, row.dataset.linea1, row.dataset.linea2);
    }

    datiPuliti = cleanData(jsonData);
    getTimelineRange(datiPuliti);
    generateTimelineHeader();
    loadFornitori();

    rotteBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Seleziona un fornitore per visualizzare le rotte</td></tr>`;
    timelineBody.innerHTML = `<tr><td colspan="${giorniTimeline.length + 1}" class="text-center text-muted">Seleziona una rotta per visualizzare le versioni</td></tr>`;
});
