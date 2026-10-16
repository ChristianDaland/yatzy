document.addEventListener('DOMContentLoaded', () => {
    let playerObjects = [];
    let currentPlayerIndex = 0;
    let rollsLeft = 3;
    let currentDiceValues = [1, 1, 1, 1, 1];
    let diceScene = null;
    let hasRolledThisTurn = false;

    const categories = [
        { id: 'ones', name: 'Enere', type: 'upper' },
        { id: 'twos', name: 'Toere', type: 'upper' },
        { id: 'threes', name: 'Treere', type: 'upper' },
        { id: 'fours', name: 'Firere', type: 'upper' },
        { id: 'fives', name: 'Femmere', type: 'upper' },
        { id: 'sixes', name: 'Seksere', type: 'upper' },
        { id: 'sum_upper', name: 'SUM', type: 'summary' },
        { id: 'bonus', name: 'BONUS', type: 'summary' },
        { id: 'one_pair', name: 'Ett par', type: 'lower' },
        { id: 'two_pairs', name: 'To par', type: 'lower' },
        { id: 'three_kind', name: 'Tre like', type: 'lower' },
        { id: 'four_kind', name: 'Fire like', type: 'lower' },
        { id: 'small_straight', name: 'Liten straight', type: 'lower' },
        { id: 'large_straight', name: 'Stor straight', type: 'lower' },
        { id: 'full_house', name: 'Hus', type: 'lower' },
        { id: 'chance', name: 'Sjanse', type: 'lower' },
        { id: 'yatzy', name: 'Yatzy', type: 'lower' },
        { id: 'total', name: 'TOTALT', type: 'total' }
    ];

    let scores = {};

    function processPlayerNames(inputVal) {
        let rawNames = inputVal.split(',').map(p => p.trim()).filter(p => p.length > 0);

        if (rawNames.length > 5) {
            alert('Maksimalt 5 spillere tillatt samtidig!');
            rawNames = rawNames.slice(0, 5);
        }
        if (rawNames.length === 0) rawNames = ['Spiller 1'];

        playerObjects = rawNames.map(name => {
            let displayName = name.length > 3 ? name.substring(0, 3) : name;
            return { original: name, display: displayName };
        });
    }

    function initGame() {
        diceScene = new DiceScene('dice-container');

        document.getElementById('start-game-btn').addEventListener('click', () => {
            const inputVal = document.getElementById('player-names-input').value;
            processPlayerNames(inputVal);

            scores = {};
            playerObjects.forEach(pObj => {
                scores[pObj.original] = {};
            });

            currentPlayerIndex = 0;
            rollsLeft = 3;
            hasRolledThisTurn = false;
            currentDiceValues = [1, 1, 1, 1, 1];

            const overlay = document.getElementById('setup-overlay');
            overlay.style.display = 'none';
            overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';

            buildScoreboard();
            updateUI();
        });

        document.getElementById('roll-btn').addEventListener('click', () => {
            if (rollsLeft <= 0) return;

            document.getElementById('roll-btn').disabled = true;

            const nextValues = currentDiceValues.map((val, idx) => {
                return diceScene.heldDice[idx] ? val : (Math.floor(Math.random() * 6) + 1);
            });

            diceScene.animateRoll(() => {
                currentDiceValues = nextValues;
                rollsLeft--;
                hasRolledThisTurn = true;
                document.getElementById('roll-btn').disabled = (rollsLeft === 0);
                updateUI();
            }, nextValues);
        });
    }

    function buildScoreboard() {
        const headerTr = document.getElementById('scoreboard-header');
        headerTr.innerHTML = '<th>Kategori</th>';

        playerObjects.forEach(pObj => {
            const th = document.createElement('th');
            th.textContent = pObj.display;
            th.title = pObj.original;
            headerTr.appendChild(th);
        });

        const tbody = document.getElementById('scoreboard-body');
        tbody.innerHTML = '';

        categories.forEach(cat => {
            const tr = document.createElement('tr');
            if (cat.type === 'summary') tr.classList.add('summary-row');
            if (cat.type === 'total') tr.classList.add('total-row');

            const tdCat = document.createElement('td');
            tdCat.textContent = cat.name;
            tr.appendChild(tdCat);

            playerObjects.forEach((pObj, pIdx) => {
                const tdScore = document.createElement('td');
                tdScore.dataset.player = pObj.original;
                tdScore.dataset.category = cat.id;

                if (cat.type !== 'summary' && cat.type !== 'total') {
                    tdScore.addEventListener('click', () => {
                        if (pIdx === currentPlayerIndex &&
                            scores[pObj.original][cat.id] === undefined &&
                            hasRolledThisTurn) {

                            const scoreToSave = calculateCategoryScore(cat.id, currentDiceValues);
                            // Lagre poeng
                            if (!scores[pObj.original]) scores[pObj.original] = {};
                            scores[pObj.original][cat.id] = scoreToSave;

                            // Oppdater bonus i scores
                            scores[pObj.original]['bonus'] = getBonus(pObj.original);

                            // Oppdater UI (planlegger repaint)
                            updateUI();

                            // --- Tving layout flush (robust seleksjon av total-celler) ---
                            // Les en layout-egenskap for å tvinge browser til å flush'e layout/malingskøen
                            const anyTotalCell = document.querySelector('td[data-category="total"]');
                            if (anyTotalCell) {
                                // Les offsetHeight på hver total-celle for alle spillere for ekstra sikkerhet
                                Array.from(document.querySelectorAll('td[data-category="total"]'))
                                    .forEach(td => void td.offsetHeight);
                            } else {
                                void document.body.offsetHeight;
                            }

                            // --- EKSPRESS: Oppdater TOTALT-cellenes tekst direkte fra scores for alle spillere ---
                            // Dette sikrer at tabellen viser nøyaktig samme totalsum som scores før modal vises.
                            playerObjects.forEach(po => {
                                const player = po.original;
                                const totalCell = Array.from(document.querySelectorAll('td[data-category="total"]'))
                                    .find(td => td.dataset.player === player);
                                if (totalCell) {
                                    totalCell.textContent = String(getTotal(player));
                                }
                            });

                            // Beregn vinner direkte fra scores (ikke fra DOM)
                            let bestScore = -1;
                            let winners = [];
                            playerObjects.forEach(po => {
                                const tot = getTotal(po.original);
                                if (tot > bestScore) {
                                    bestScore = tot;
                                    winners = [po.original];
                                } else if (tot === bestScore) {
                                    winners.push(po.original);
                                }
                            });

                            // Vis modal med de beregnede verdiene
                            if (checkGameOver()) {
                                showGameOverModal(winners, bestScore);
                            } else {
                                nextTurn();
                            }
                        }
                    });
                }

                tr.appendChild(tdScore);
            });

            tbody.appendChild(tr);
        });
    }

    function checkGameOver() {
        const upperAndLowerCats = categories.filter(c => c.type === 'upper' || c.type === 'lower');
        for (const pObj of playerObjects) {
            for (const cat of upperAndLowerCats) {
                if (scores[pObj.original][cat.id] === undefined) return false;
            }
        }
        return true;
    }

    
function showGameOverModal(passedWinners = null, passedBestScore = null) {
    // Sørg for at bonus er oppdatert i scores før vi viser noe
    playerObjects.forEach(pObj => {
        if (!scores[pObj.original]) scores[pObj.original] = {};
        scores[pObj.original]['bonus'] = getBonus(pObj.original);
    });

    // Oppdater UI slik at tabellen er i sync
    updateUI();

    // Som ekstra sikkerhet, oppdater TOTALT-celler direkte fra scores
    playerObjects.forEach(po => {
        const player = po.original;
        const totalCell = Array.from(document.querySelectorAll('td[data-category="total"]'))
            .find(td => td.dataset.player === player);
        if (totalCell) totalCell.textContent = String(getTotal(player));
    });

    // Hvis caller allerede har beregnet winners og bestScore, bruk dem.
    let bestScore = passedBestScore;
    let winners = passedWinners;

    if (winners == null || bestScore == null) {
        bestScore = -1;
        winners = [];

        playerObjects.forEach(pObj => {
            const tot = getTotal(pObj.original);
            if (tot > bestScore) {
                bestScore = tot;
                winners = [pObj.original];
            } else if (tot === bestScore) {
                winners.push(pObj.original);
            }
        });
    }

    // Bygg modal-innhold (men vis den ikke ennå)
    const overlay = document.getElementById('setup-overlay');
    const modal = document.querySelector('#setup-overlay .modal');
    if (!modal || !overlay) return;

    let message = '';
    if (winners.length === 1) {
        message = `Spillet er ferdig! Vinneren er <strong>${winners[0]}</strong> med ${bestScore} poeng!`;
    } else {
        message = `Spillet er ferdig! Uavgjort mellom ${winners.join(' og ')} med ${bestScore} poeng!`;
    }

    modal.innerHTML = `
        <h2>Spillet er over!</h2>
        <p>${message}</p>
        <input type="text" id="player-names-input" value="${playerObjects.map(p => p.original).join(', ')}">
        <button id="start-game-btn">START NYTT SPILL</button>
    `;

    // Vent til browser har malt oppdateringene før overlay gjøres synlig
    // Dobbel requestAnimationFrame gir god garanti for at repaint er fullført
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.style.backgroundColor = 'transparent';
            overlay.style.display = 'flex';

            // Koble start-knappen etter at modal er synlig
            const startBtn = document.getElementById('start-game-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    const inputVal = document.getElementById('player-names-input').value;
                    processPlayerNames(inputVal);

                    scores = {};
                    playerObjects.forEach(pObj => {
                        scores[pObj.original] = {};
                    });

                    currentPlayerIndex = 0;
                    rollsLeft = 3;
                    hasRolledThisTurn = false;
                    currentDiceValues = [1, 1, 1, 1, 1];

                    overlay.style.display = 'none';
                    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
                    buildScoreboard();
                    updateUI();
                });
            }
        });
    });
}


    function calculateCategoryScore(catId, dice) {
        const counts = {};
        dice.forEach(d => counts[d] = (counts[d] || 0) + 1);

        switch (catId) {
            case 'ones': return (counts[1] || 0) * 1;
            case 'twos': return (counts[2] || 0) * 2;
            case 'threes': return (counts[3] || 0) * 3;
            case 'fours': return (counts[4] || 0) * 4;
            case 'fives': return (counts[5] || 0) * 5;
            case 'sixes': return (counts[6] || 0) * 6;

            case 'one_pair':
                for (let i = 6; i >= 1; i--) {
                    if ((counts[i] || 0) >= 2) return i * 2;
                }
                return 0;

            case 'two_pairs': {
                let pairs = [];
                for (let i = 6; i >= 1; i--) {
                    if ((counts[i] || 0) >= 2) pairs.push(i);
                }
                if (pairs.length >= 2) return pairs[0] * 2 + pairs[1] * 2;
                return 0;
            }

            case 'three_kind':
                for (let i = 6; i >= 1; i--) {
                    if ((counts[i] || 0) >= 3) return i * 3;
                }
                return 0;

            case 'four_kind':
                for (let i = 6; i >= 1; i--) {
                    if ((counts[i] || 0) >= 4) return i * 4;
                }
                return 0;

            case 'small_straight':
                if (counts[1] && counts[2] && counts[3] && counts[4] && counts[5]) return 15;
                return 0;

            case 'large_straight':
                if (counts[2] && counts[3] && counts[4] && counts[5] && counts[6]) return 20;
                return 0;

            case 'full_house': {
                let hasThree = 0;
                let hasTwo = 0;
                for (let i = 6; i >= 1; i--) {
                    if ((counts[i] || 0) === 3) hasThree = i;
                    else if ((counts[i] || 0) === 2) hasTwo = i;
                }
                if (hasThree > 0 && hasTwo > 0) return hasThree * 3 + hasTwo * 2;
                return 0;
            }

            case 'chance':
                return dice.reduce((a, b) => a + b, 0);

            case 'yatzy':
                for (let i = 6; i >= 1; i--) {
                    if ((counts[i] || 0) === 5) return 50;
                }
                return 0;

            default:
                return 0;
        }
    }

    function getSumUpper(p) {
        const upperCats = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
        if (!scores[p]) return 0;
        return upperCats.reduce((acc, cat) => acc + (scores[p][cat] || 0), 0);
    }

    function getBonus(p) {
        return getSumUpper(p) >= 63 ? 50 : 0;
    }

    function getTotal(p) {
        if (!scores[p]) return 0;
        let total = 0;
        categories.forEach(cat => {
            if (cat.type === 'upper' || cat.type === 'lower') {
                total += (scores[p][cat.id] || 0);
            }
        });
        return total + getBonus(p);
    }

    function nextTurn() {
        rollsLeft = 3;
        hasRolledThisTurn = false;
        currentPlayerIndex = (currentPlayerIndex + 1) % playerObjects.length;

        if (diceScene) {
            diceScene.resetHolds();
        }

        updateUI();

        const playerEl = document.getElementById('current-player');
        if (playerEl) {
            playerEl.classList.remove('turn-animate');
            void playerEl.offsetWidth;
            playerEl.classList.add('turn-animate');
        }
    }

    function updateUI() {
        const activePlayerObj = playerObjects[currentPlayerIndex];
        const currentPlayerEl = document.getElementById('current-player');
        if (currentPlayerEl && activePlayerObj) {
            currentPlayerEl.textContent = `Spiller: ${activePlayerObj.original}`;
        }
        const rollsLeftEl = document.getElementById('rolls-left');
        if (rollsLeftEl) rollsLeftEl.textContent = `Kast igjen: ${rollsLeft}`;

        const rollBtn = document.getElementById('roll-btn');
        if (rollBtn) rollBtn.disabled = (rollsLeft === 0);

        categories.forEach(cat => {
            playerObjects.forEach((pObj, pIdx) => {
                const p = pObj.original;
                const td = Array.from(document.querySelectorAll(`td[data-category="${cat.id}"]`))
                    .find(td => td.dataset.player === p);
                if (!td) return;

                if (cat.id === 'sum_upper') {
                    td.textContent = String(getSumUpper(p));
                } else if (cat.id === 'bonus') {
                    const bVal = getBonus(p);
                    if (!scores[p]) scores[p] = {};
                    scores[p]['bonus'] = bVal;
                    td.textContent = String(bVal);
                } else if (cat.id === 'total') {
                    td.textContent = String(getTotal(p));
                } else if (scores[p] && scores[p][cat.id] !== undefined) {
                    td.textContent = String(scores[p][cat.id]);
                    td.classList.remove('preview');
                    td.classList.add('filled');
                } else if (pIdx === currentPlayerIndex && hasRolledThisTurn) {
                    const previewVal = calculateCategoryScore(cat.id, currentDiceValues);
                    td.textContent = String(previewVal);
                    td.classList.add('preview');
                    td.classList.remove('filled');
                } else {
                    td.textContent = '-';
                    td.classList.remove('preview', 'filled');
                }
            });
        });
    }

    // Standard oppstart
    processPlayerNames('Heidi, Christian');
    scores = {};
    playerObjects.forEach(pObj => {
        scores[pObj.original] = {};
    });

    initGame();
    buildScoreboard();
    updateUI();
});
