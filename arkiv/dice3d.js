class DiceScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Finner ikke element med ID '${containerId}'`);
            return;
        }
        this.dice = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.textures = [];
        
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e14);

        const w = this.container.clientWidth;
        const h = this.container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        this.camera.position.set(0, 11, 9);
        this.camera.lookAt(0, -1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Belysning
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(5, 14, 5);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Bordflate
        const floorGeo = new THREE.PlaneGeometry(18, 14);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x16213e, roughness: 0.4 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.createTextures();
        this.createDice();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    }

    createDotTexture(number) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, 242, 242);

        ctx.fillStyle = '#0f172a';
        const dotRadius = 24;
        const dots = {
            1: [[128, 128]],
            2: [[64, 64], [192, 192]],
            3: [[64, 64], [128, 128], [192, 192]],
            4: [[64, 64], [192, 64], [64, 192], [192, 192]],
            5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]],
            6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]]
        };

        if (dots[number]) {
            dots[number].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        return new THREE.CanvasTexture(canvas);
    }

    createTextures() {
        for (let i = 1; i <= 6; i++) {
            this.textures[i] = this.createDotTexture(i);
        }
    }

    getStandardMaterials() {
        return [
            new THREE.MeshStandardMaterial({ map: this.textures[1], roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ map: this.textures[6], roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ map: this.textures[2], roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ map: this.textures[5], roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ map: this.textures[3], roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ map: this.textures[4], roughness: 0.3 })
        ];
    }

    setDieValueRotation(die, value, randomYAngle) {
        const qBase = new THREE.Quaternion();
        
        switch (value) {
            case 1:
                qBase.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
                break;
            case 6:
                qBase.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
                break;
            case 2:
                qBase.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
                break;
            case 5:
                qBase.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
                break;
            case 3:
                qBase.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                break;
            case 4:
                qBase.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
                break;
        }

        const qY = new THREE.Quaternion();
        qY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), randomYAngle);
        
        qY.multiply(qBase);
        die.quaternion.copy(qY);
    }

    generateSeparatedPositions() {
        const positions = [];
        const minDistance = 2.8;
        const maxAttempts = 1000;

        for (let i = 0; i < 5; i++) {
            if (this.dice[i] && this.dice[i].userData.held) {
                positions.push(new THREE.Vector3(this.dice[i].position.x, 0.6, this.dice[i].position.z));
                continue;
            }

            let valid = false;
            let attempts = 0;
            let candidate;

            while (!valid && attempts < maxAttempts) {
                attempts++;
                const x = -5.5 + Math.random() * 6.5;
                const z = -2.2 + Math.random() * 4.4;
                candidate = new THREE.Vector3(x, 0.6, z);

                valid = true;
                for (let j = 0; j < positions.length; j++) {
                    const dist = candidate.distanceTo(positions[j]);
                    if (dist < minDistance) {
                        valid = false;
                        break;
                    }
                }
            }

            if (!valid) {
                const gridX = -4.8 + (i * 2.4);
                const gridZ = (i % 2 === 0 ? 1.4 : -1.4);
                candidate = new THREE.Vector3(gridX, 0.6, gridZ);
            }

            positions.push(candidate);
        }
        return positions;
    }

    createDice() {
        const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const materials = this.getStandardMaterials();
        const positions = this.generateSeparatedPositions();

        for (let i = 0; i < 5; i++) {
            const die = new THREE.Mesh(geometry, materials);
            die.castShadow = true;
            
            const pos = positions[i];
            die.position.set(pos.x, 0.6, pos.z);
            
            die.userData = { 
                index: i, 
                value: 1, 
                held: false,
                targetPos: pos.clone(),
                targetRotY: (Math.random() - 0.5) * 0.6
            };
            
            this.setDieValueRotation(die, 1, die.userData.targetRotY);

            this.scene.add(die);
            this.dice.push(die);
        }
    }

    onPointerDown(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.dice);

        if (intersects.length > 0) {
            const die = intersects[0].object;
            die.userData.held = !die.userData.held;
            die.position.y = die.userData.held ? 1.4 : 0.6;
        }
    }

    animateRoll(callback) {
        let frames = 0;
        const maxFrames = 45;
        const finalValues = this.dice.map(d => d.userData.held ? d.userData.value : Math.floor(Math.random() * 6) + 1);
        const newPositions = this.generateSeparatedPositions();

        this.dice.forEach((die, idx) => {
            if (!die.userData.held) {
                die.userData.targetPos = newPositions[idx];
                die.userData.targetRotY = (Math.random() - 0.5) * Math.PI * 2;
                die.userData.startPos = die.position.clone();
                die.userData.rotSpeedX = (Math.random() * 0.4 + 0.2);
                die.userData.rotSpeedZ = (Math.random() * 0.4 + 0.2);
                die.userData.arcHeight = 1.2 + Math.random() * 0.8;
            }
        });

        const interval = setInterval(() => {
            frames++;
            const progress = frames / maxFrames;

            this.dice.forEach((die) => {
                if (!die.userData.held) {
                    die.rotation.x += die.userData.rotSpeedX;
                    die.rotation.z += die.userData.rotSpeedZ;

                    die.position.x = THREE.MathUtils.lerp(die.userData.startPos.x, die.userData.targetPos.x, progress);
                    die.position.z = THREE.MathUtils.lerp(die.userData.startPos.z, die.userData.targetPos.z, progress);

                    const arc = Math.sin(progress * Math.PI) * die.userData.arcHeight * (1 - progress);
                    die.position.y = 0.6 + arc;
                }
            });

            if (frames >= maxFrames) {
                clearInterval(interval);
                this.dice.forEach((die, idx) => {
                    die.userData.value = finalValues[idx];
                    
                    this.setDieValueRotation(die, finalValues[idx], die.userData.targetRotY);
                    
                    die.position.x = die.userData.targetPos.x;
                    die.position.z = die.userData.targetPos.z;
                    die.position.y = die.userData.held ? 1.4 : 0.6;
                });

                if (callback) callback(finalValues);
            }
        }, 25);
    }

    resetHolds() {
        this.dice.forEach(die => {
            die.userData.held = false;
            die.position.y = 0.6;
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.container) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}
