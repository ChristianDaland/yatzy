class DiceScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        const w = this.container.clientWidth;
        const h = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.diceList = [];
        this.heldDice = [false, false, false, false, false];
        // Terninger kan bare holdes etter at gjeldende spiller har kastet (og ikke mens de ruller)
        this.holdingEnabled = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.initLights();
        this.initCamera();
        this.initTable();
        this.initDice();

        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        window.addEventListener('resize', () => this.onWindowResize());

        this.animate();
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(5, 15, 8);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    initCamera() {
        this.camera.position.set(0, 10, 8);
        this.camera.lookAt(0, 0, 0);
    }

    initTable() {
        const geometry = new THREE.PlaneGeometry(16, 12);
        const material = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const table = new THREE.Mesh(geometry, material);
        table.rotation.x = -Math.PI / 2;
        table.receiveShadow = true;
        this.scene.add(table);
    }

    initDice() {
        const startPositions = [
            [-3.5, 0.5, -1.0],
            [-1.75, 0.5, 1.0],
            [0.0, 0.5, -0.5],
            [1.75, 0.5, 1.2],
            [3.5, 0.5, -0.8]
        ];

        startPositions.forEach((pos, index) => {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const materials = this.createDiceMaterials();
            const die = new THREE.Mesh(geometry, materials);
            die.position.set(...pos);
            die.castShadow = true;
            die.userData = { index: index, targetValue: 1 };

            this.setDieFace(die, 1);

            this.scene.add(die);
            this.diceList.push(die);
        });
    }

    createDiceMaterials() {
        const createFace = (number) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 128, 128);

            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 6;
            ctx.strokeRect(4, 4, 120, 120);

            ctx.fillStyle = '#0f172a';
            const dots = {
                1: [[64, 64]],
                2: [[32, 32], [96, 96]],
                3: [[32, 32], [64, 64], [96, 96]],
                4: [[32, 32], [96, 32], [32, 96], [96, 96]],
                5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],
                6: [[32, 32], [96, 32], [32, 64], [96, 64], [32, 96], [96, 96]]
            };

            if (dots[number]) {
                dots[number].forEach(([x, y]) => {
                    ctx.beginPath();
                    ctx.arc(x, y, 11, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            const texture = new THREE.CanvasTexture(canvas);
            return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 });
        };

        return [
            createFace(4),
            createFace(3),
            createFace(1),
            createFace(6),
            createFace(2),
            createFace(5)
        ];
    }

    setDieFace(die, value) {
        die.rotation.set(0, 0, 0);

        switch (value) {
            case 1:
                die.rotation.set(0, 0, 0);
                break;
            case 6:
                die.rotation.set(Math.PI, 0, 0);
                break;
            case 3:
                die.rotation.set(0, 0, -Math.PI / 2);
                break;
            case 4:
                die.rotation.set(0, 0, Math.PI / 2);
                break;
            case 2:
                die.rotation.set(-Math.PI / 2, 0, 0);
                break;
            case 5:
                die.rotation.set(Math.PI / 2, 0, 0);
                break;
        }
    }

    onPointerDown(event) {
        if (!this.holdingEnabled) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.diceList);

        if (intersects.length > 0) {
            const clickedDie = intersects[0].object;
            const index = clickedDie.userData.index;

            this.heldDice[index] = !this.heldDice[index];
            clickedDie.position.y = this.heldDice[index] ? 1.2 : 0.5;
        }
    }

    animateRoll(onComplete, targetValues) {
        let completedAnimations = 0;
        const basePositions = [
            [-3.5, -1.0],
            [-1.75, 1.0],
            [0.0, -0.5],
            [1.75, 1.2],
            [3.5, -0.8]
        ];

        this.diceList.forEach((die, i) => {
            if (this.heldDice[i]) {
                completedAnimations++;
                if (completedAnimations === 5 && onComplete) onComplete();
                return;
            }

            const rolledVal = targetValues[i];
            die.userData.targetValue = rolledVal;

            const targetX = basePositions[i][0] + (Math.random() * 0.6 - 0.3);
            const targetZ = basePositions[i][1] + (Math.random() * 0.6 - 0.3);

            const duration = 600 + Math.random() * 200;
            const startTime = performance.now();

            const rollStep = (time) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);

                if (progress < 1) {
                    die.rotation.x += 0.25;
                    die.rotation.y += 0.3;
                    die.rotation.z += 0.2;

                    die.position.y = 0.5 + Math.sin(progress * Math.PI) * 1.6;
                    die.position.x = THREE.MathUtils.lerp(die.position.x, targetX, 0.1);
                    die.position.z = THREE.MathUtils.lerp(die.position.z, targetZ, 0.1);

                    requestAnimationFrame(rollStep);
                } else {
                    die.position.set(targetX, 0.5, targetZ);
                    this.setDieFace(die, rolledVal);

                    completedAnimations++;
                    if (completedAnimations === 5 && onComplete) {
                        onComplete();
                    }
                }
            };

            requestAnimationFrame(rollStep);
        });
    }

    resetHolds() {
        this.heldDice = [false, false, false, false, false];
        this.holdingEnabled = false;
        this.diceList.forEach(die => {
            die.position.y = 0.5;
        });
    }

    onWindowResize() {
        if (!this.container) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}
