/**
 * GEODEO 3D Digital Elevation Model (NMT / LIDAR + Farma PV + Wieża BOT-3E + Pomiar Pionowości Tachimetrem)
 * - Powolna, majestatyczna animacja siatki wysokościowej NMT
 * - Wyraźna, płynna reakcja sceny 3D i kursora laserowego na ruch myszką
 * - Dopracowana wizualizacja Farmy Fotowoltaicznej:
 *   * solidne przednie (krótsze) i tylne (dłuższe) nogi o profilu stalowym z obrysem CAD,
 *   * głowice łączące nogi z krokwiami, stopy kafarowania na siatce i ukośne zastrzały,
 *   * zarysy podłużnych szyn nośnych oraz wyraźne dylatacje między modułami PV,
 *   * automatyczne dopasowanie płaszczyzny posadowienia stołu do lokalnego spadku terenu.
 * - Trójnożna wieża telekomunikacyjna BOT-3E o podstawie trójkąta równobocznego
 * - Stanowisko geodezyjne po lewej stronie wieży: geodeta z tachimetrem na statywie
 *   wycelowanym w czubek wieży (pomiar pionowości konstrukcji z wiązką laserową EDM).
 */

(function () {
  function initGeodeoTerrain3D() {
    const container = document.getElementById('hero-3d-canvas-container');
    if (!container || typeof THREE === 'undefined') return;

    // Buforowane wymiary widoku (brak kosztownego odczytu DOM w pętli requestAnimationFrame)
    let cachedWidth = container.clientWidth || window.innerWidth;
    let cachedHeight = container.clientHeight || 560;
    let isMobileViewport = cachedWidth < 768;

    // 1. Scena i mgła przestrzenna
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050914, 0.008);

    // 2. Kamera perspektywiczna (domyślny kadr desktopowy)
    const camera = new THREE.PerspectiveCamera(
      48,
      cachedWidth / cachedHeight,
      0.1,
      600
    );
    const cameraTarget = new THREE.Vector3(16.0, 14.5, -7.0);
    camera.position.set(12.0, 15.5, 54.0);
    camera.lookAt(cameraTarget);

    // Smartfony (< 768px): tryb STATYCZNY – jedna ostra klatka bez pętli animacji (brak lagów)
    let staticMode = isMobileViewport;

    // 3. Renderer WebGL
    // Antyaliasing włączony zawsze – w trybie statycznym koszt jest jednorazowy, a linie siatki pozostają ostre
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(cachedWidth, cachedHeight);
    // Mobile: pełna gęstość pikseli ekranu (do 2x) = ostra siatka bez rozmycia; desktop bez zmian
    renderer.setPixelRatio(staticMode ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x050914, 1);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Grupa główna świata 3D
    const worldGroup = new THREE.Group();
    const baseYaw = -0.18;
    worldGroup.rotation.y = baseYaw;
    scene.add(worldGroup);

    // =========================================================================
    // MODEL WYSOKOŚCIOWY TERENU: REALISTYCZNE POŁONINY BIESZCZADZKIE (NMT / CAD)
    // Oparto na charakterystycznej topografii Połoniny Wetlińskiej i Caryńskiej:
    // - Pasmo Główne z wieloma kulminacjami i siodłami połoninowymi (kierunek NW-SE)
    // - Równoległe Pasmo Przednie (punkt widokowy geodety) i Pasmo Graniczne w głębi
    // - Naturalne fałdy fliszowe, doliny potoków i łagodna terasa górska pod farmę PV
    // =========================================================================
    const BIESZCZADY_ANGLE = -0.42; // kierunek przebiegu grzbietów fliszu karpackiego
    const cosRidge = Math.cos(BIESZCZADY_ANGLE);
    const sinRidge = Math.sin(BIESZCZADY_ANGLE);

    function computeStaticTerrainParams(x, z) {
      // Współrzędne zorientowane wzdłuż (u) i w poprzek (v) pasm połoninowych
      const u = x * cosRidge + z * sinRidge;
      const v = -x * sinRidge + z * cosRidge;

      // 1. Pasmo Główne Połoniny (Caryńska / Wetlińska) – wyrazisty, falisty grzbiet
      const distMain = v - (-7.5);
      const mainProfile = Math.exp(-(distMain * distMain) / 160.0);
      const mainCrest = 6.2 + 2.4 * Math.cos(u * 0.115 - 0.75) + 1.2 * Math.sin(u * 0.23 + 0.35);
      const rMain = mainProfile * mainCrest;

      // 2. Pasmo Przednie (południowy grzbiet widokowy pod stanowisko geodezyjne)
      const distFront = v - 13.0;
      const frontProfile = Math.exp(-(distFront * distFront) / 185.0);
      const frontCrest = 3.8 + 1.4 * Math.cos(u * 0.095 + 0.45) + 0.7 * Math.sin(u * 0.19);
      const rFront = frontProfile * frontCrest;

      // 3. Pasmo Graniczne w głębi (monumentalny bieszczadzki horyzont)
      const distBack = v - (-31.0);
      const backProfile = Math.exp(-(distBack * distBack) / 240.0);
      const backCrest = 7.8 + 2.6 * Math.cos(u * 0.08 + 1.1);
      const rBack = backProfile * backCrest;

      // 4. Dolinki, debrza i naturalne fałdy fliszowe na stokach połonin
      const folds = Math.sin(u * 0.13 + v * 0.065) * Math.cos(v * 0.10) * 1.5 +
                    Math.cos(u * 0.22 - v * 0.08) * 0.65 +
                    Math.sin(u * 0.38 + v * 0.18) * 0.25;

      // 5. Stabilne wyniesienie grzbietowe pod wieżę telekomunikacyjną BOT-3E na pierwszym planie
      const distTower = Math.sqrt((x - 16.5) * (x - 16.5) + (z + 7.0) * (z + 7.0));
      const towerKnoll = Math.exp(-(distTower * distTower) / 36.0) * 1.8;

      // 6. Naturalne wzniesienie pod stanowisko geodety z tachimetrem
      const distSurv = Math.sqrt((x - 0.5) * (x - 0.5) + (z + 14.0) * (z + 14.0));
      const survKnoll = Math.exp(-(distSurv * distSurv) / 30.0) * 1.2;

      // 7. Terasa górska o łagodnym spadku pod instalację farmy PV (dwa rzędy po 3 stoły)
      const pvDist = Math.sqrt((x - 0.0) * (x - 0.0) + (z - 4.5) * (z - 4.5));
      const pvTerraceFactor = Math.max(0.0, 1.0 - pvDist / 16.0);

      // 8. Płynne wygaszenie krawędzi siatki ku granicom przestrzeni
      const distCenter = Math.sqrt(x * x + z * z);
      const edgeFade = Math.max(0.0, 1.0 - Math.pow(distCenter / 72.0, 3.5));

      let baseElev = (rMain + rFront + rBack + folds + towerKnoll + survKnoll) * edgeFade - 2.6;
      baseElev = baseElev * (1.0 - pvTerraceFactor * 0.22);
      const waveFactor = edgeFade * (1.0 - pvTerraceFactor * 0.7);

      return {
        factor: waveFactor,
        offset: baseElev
      };
    }

    function getDynamicWaves(x, z, time) {
      const t = time * 0.038;
      const wave1 = Math.sin(x * 0.042 + t * 0.7) * Math.cos(z * 0.042 + t * 0.55) * 1.1;
      const wave2 = Math.sin((x * 0.65 - z * 0.55) * 0.085 - t * 0.8) * 0.5;
      return wave1 + wave2;
    }

    function getTerrainElevation(x, z, time) {
      const st = computeStaticTerrainParams(x, z);
      return getDynamicWaves(x, z, time) * st.factor + st.offset;
    }

    // =========================================================================
    // SIATKA TERENU NMT + CHMURA PUNKTÓW LIDAR (POŁONINY BIESZCZADZKIE)
    // =========================================================================
    const width = 145;
    const depth = 145;
    // Gęstość siatki NMT – bogata rzeźba terenu bez wpływu na wydajność
    const segmentsX = 96;
    const segmentsY = 96;

    const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsY);
    geometry.rotateX(-Math.PI / 2);

    const vertexCount = geometry.attributes.position.count;
    const colors = new Float32Array(vertexCount * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const posAttr = geometry.attributes.position;
    const basePositions = new Float32Array(vertexCount * 2);
    const vertexStaticFactor = new Float32Array(vertexCount);
    const vertexStaticOffset = new Float32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      basePositions[i * 2] = vx;
      basePositions[i * 2 + 1] = vz;
      const st = computeStaticTerrainParams(vx, vz);
      vertexStaticFactor[i] = st.factor;
      vertexStaticOffset[i] = st.offset;
    }

    const solidMaterial = new THREE.MeshStandardMaterial({
      color: 0x060c1a,
      roughness: 0.68,
      metalness: 0.32,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
    const solidMesh = new THREE.Mesh(geometry, solidMaterial);
    worldGroup.add(solidMesh);

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending
    });
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
    worldGroup.add(wireframeMesh);

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending
    });
    const pointsMesh = new THREE.Points(geometry, pointsMaterial);
    worldGroup.add(pointsMesh);

    const gridHelper = new THREE.GridHelper(160, 32, 0x1e3a8a, 0x0f172a);
    gridHelper.position.y = -7.5;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.25;
    worldGroup.add(gridHelper);

    // =========================================================================
    // KONSTRUKCJA FARMY FOTOWOLTAICZNEJ 3D (DOPRACOWANE NOGI, SZYNY I DYLATACJE)
    // =========================================================================
    const pvFarmGroup = new THREE.Group();
    worldGroup.add(pvFarmGroup);

    // Materiały konstrukcyjne stołów PV (jasna stal z emisją + wyraźny obrys CAD, aby nogi były doskonale widoczne)
    const legSolidMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.38,
      metalness: 0.45,
      roughness: 0.35
    });
    const legEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.95
    });
    const footplateMaterial = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.9
    });
    const railMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b
    });
    const rafterMaterial = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.3
    });
    const pvCellMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a2547,
      emissive: 0x061b3a,
      emissiveIntensity: 0.65,
      metalness: 0.85,
      roughness: 0.18
    });
    const pvFrameEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.94
    });
    const railEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.98
    });

    /**
     * Buduje pojedynczy, dwupodporowy stół fotowoltaiczny (konstrukcja kafarowana):
     * - 4 pary solidnych nóg o przekroju dwuteowym/ceowym (przednie krótsze, tylne dłuższe)
     * - Każda noga trafia idealnie w węzeł pod ukośną krokwią (z uwzględnieniem cos/sin kąta 28°)
     * - Głowice montażowe u szczytu nóg, stopy podporowe na gruncie oraz ukośne zastrzały stężające
     * - Krokwie poprzeczne oraz 4 podłużne szyny nośne wystające poza obrys modułów
     * - Moduły PV z wyraźnymi dylatacjami (przerwami)
     */
    function createDetailedPVTable(cols = 6, rows = 2) {
      const tableGroup = new THREE.Group();

      const modW = 1.02;
      const modH = 1.68;
      const modThick = 0.055;
      const gapX = 0.16; // Dylatacja pionowa między modułami
      const gapZ = 0.20; // Dylatacja pozioma między rzędami modułów

      const totalModulesWidth = cols * modW + (cols - 1) * gapX;
      const totalSlopeLength = rows * modH + (rows - 1) * gapZ;
      const railLength = totalModulesWidth + 0.65;

      // Kąt nachylenia stołu PV (28 stopni)
      const tiltAngle = 28 * (Math.PI / 180);
      const cosA = Math.cos(tiltAngle);
      const sinA = Math.sin(tiltAngle);

      // Wysokość środka stołu nad poziomem terenu
      const centerHeight = 1.72;

      // Pozycja krokwi w układzie lokalnym pochylonego stołu
      const rafterLocalY = -0.07;
      const rafterHeight = 0.11;

      // Rozstaw punktów podparcia wzdłuż pochylonej krokwi (od środka stołu)
      const sFront = totalSlopeLength * 0.31; // Przód stołu (niżej)
      const sBack = -totalSlopeLength * 0.31; // Tył stołu (wyżej)

      // Dokładne współrzędne węzłów (głowic nóg) pod dolną krawędzią pochylonej krokwi:
      const attachLocalY = rafterLocalY - rafterHeight * 0.5;
      const frontTopY = centerHeight + attachLocalY * cosA - sFront * sinA;
      const frontZ = attachLocalY * sinA + sFront * cosA;

      const backTopY = centerHeight + attachLocalY * cosA - sBack * sinA;
      const backZ = attachLocalY * sinA + sBack * cosA;

      // Część podziemna (kafarowana w głąb gruntu) i naziemna nóg
      const pileEmbed = -0.45;

      // 1. CZTERY LUB TRZY RAMY PODPOROWE (W ZALEŻNOŚCI OD DŁUGOŚCI STOŁU)
      const numSupports = Math.max(3, Math.min(4, Math.round(cols * 0.75)));
      const supportSpanX = totalModulesWidth * 0.82;

      const legProfileW = 0.11;
      const legProfileD = 0.14;

      const frontLegLen = frontTopY - pileEmbed;
      const backLegLen = backTopY - pileEmbed;

      const frontLegGeo = new THREE.BoxGeometry(legProfileW, frontLegLen, legProfileD);
      const frontLegEdges = new THREE.EdgesGeometry(frontLegGeo);

      const backLegGeo = new THREE.BoxGeometry(legProfileW, backLegLen, legProfileD);
      const backLegEdges = new THREE.EdgesGeometry(backLegGeo);

      // Głowica łącząca szczyt nogi z krokwią
      const capGeo = new THREE.BoxGeometry(0.18, 0.12, 0.24);
      const capEdges = new THREE.EdgesGeometry(capGeo);

      // Stopa / kołnierz na poziomie gruntu (y = 0), podkreślający miejsce wbicia nogi w siatkę NMT
      const footCollarGeo = new THREE.BoxGeometry(0.28, 0.06, 0.32);

      // Pomocnicza funkcja do budowy ukośnego zastrzału 3D między tylną nogą a krokwią/przednią nogą
      function createBraceMesh(p1, p2) {
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        const braceGeo = new THREE.BoxGeometry(0.065, len, 0.065);
        const braceMesh = new THREE.Mesh(braceGeo, legSolidMaterial);
        braceMesh.position.copy(p1).add(p2).multiplyScalar(0.5);
        braceMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

        const braceWire = new THREE.LineSegments(new THREE.EdgesGeometry(braceGeo), legEdgeMaterial);
        braceMesh.add(braceWire);
        return braceMesh;
      }

      for (let s = 0; s < numSupports; s++) {
        const sx = -supportSpanX / 2 + (s / (numSupports - 1)) * supportSpanX;

        // --- PRZEDNIA NOGA (KRÓTSZA) ---
        const frontLeg = new THREE.Mesh(frontLegGeo, legSolidMaterial);
        frontLeg.position.set(sx, pileEmbed + frontLegLen * 0.5, frontZ);
        frontLeg.add(new THREE.LineSegments(frontLegEdges, legEdgeMaterial));
        tableGroup.add(frontLeg);

        // Głowica przedniej nogi (pod krokwią)
        const frontCap = new THREE.Mesh(capGeo, rafterMaterial);
        frontCap.position.set(sx, frontTopY, frontZ);
        frontCap.rotation.x = tiltAngle;
        frontCap.add(new THREE.LineSegments(capEdges, railEdgeMaterial));
        tableGroup.add(frontCap);

        // Kołnierz przyziemny przedniej nogi
        const frontFoot = new THREE.Mesh(footCollarGeo, footplateMaterial);
        frontFoot.position.set(sx, 0.03, frontZ);
        tableGroup.add(frontFoot);

        // --- TYLNA NOGA (DŁUŻSZA) ---
        const backLeg = new THREE.Mesh(backLegGeo, legSolidMaterial);
        backLeg.position.set(sx, pileEmbed + backLegLen * 0.5, backZ);
        backLeg.add(new THREE.LineSegments(backLegEdges, legEdgeMaterial));
        tableGroup.add(backLeg);

        // Głowica tylnej nogi (pod krokwią)
        const backCap = new THREE.Mesh(capGeo, rafterMaterial);
        backCap.position.set(sx, backTopY, backZ);
        backCap.rotation.x = tiltAngle;
        backCap.add(new THREE.LineSegments(capEdges, railEdgeMaterial));
        tableGroup.add(backCap);

        // Kołnierz przyziemny tylnej nogi
        const backFoot = new THREE.Mesh(footCollarGeo, footplateMaterial);
        backFoot.position.set(sx, 0.03, backZ);
        tableGroup.add(backFoot);

        // --- ZASTRZAŁY STĘŻAJĄCE (TRÓJKĄT KRATOWNICY PODPOROWEJ STOŁU) ---
        // Główny zastrzał od dolnej części tylnej nogi do głowicy przedniej nogi
        const pRearLow = new THREE.Vector3(sx, 0.42, backZ);
        const pFrontHigh = new THREE.Vector3(sx, frontTopY - 0.04, frontZ);
        tableGroup.add(createBraceMesh(pRearLow, pFrontHigh));

        // Krótki zastrzał mieczowy od połowy tylnej nogi do środka krokwi
        const pRearMid = new THREE.Vector3(sx, backTopY * 0.55, backZ);
        const pMidRafter = new THREE.Vector3(sx, centerHeight - 0.08, 0);
        tableGroup.add(createBraceMesh(pRearMid, pMidRafter));
      }

      // 2. POCHYLONA PŁASZCZYZNA STOŁU (KROKWIE, SZYNY NOŚNE I MODUŁY Z DYLATACJAMI)
      const slopeGroup = new THREE.Group();
      slopeGroup.position.set(0, centerHeight, 0);
      slopeGroup.rotation.x = tiltAngle;
      tableGroup.add(slopeGroup);

      // 2A. Krokwie poprzeczne (rygle główne oparte na głowicach przednich i tylnych nóg)
      const rafterLen = totalSlopeLength * 0.94;
      const rafterGeo = new THREE.BoxGeometry(0.11, rafterHeight, rafterLen);
      const rafterEdges = new THREE.EdgesGeometry(rafterGeo);

      for (let s = 0; s < numSupports; s++) {
        const sx = -supportSpanX / 2 + (s / (numSupports - 1)) * supportSpanX;
        const rafter = new THREE.Mesh(rafterGeo, rafterMaterial);
        rafter.position.set(sx, rafterLocalY, 0);
        rafter.add(new THREE.LineSegments(rafterEdges, legEdgeMaterial));
        slopeGroup.add(rafter);
      }

      // 2B. CZTERY PODŁUŻNE SZYNY NOŚNE (PŁATWIE MONTAŻOWE POD MODUŁAMI)
      const railPositionsZ = [
        -(modH / 2 + gapZ / 2) - modH * 0.26,
        -(modH / 2 + gapZ / 2) + modH * 0.26,
        +(modH / 2 + gapZ / 2) - modH * 0.26,
        +(modH / 2 + gapZ / 2) + modH * 0.26
      ];
      const railBoxGeo = new THREE.BoxGeometry(railLength, 0.085, 0.095);
      const railEdgesGeo = new THREE.EdgesGeometry(railBoxGeo);

      railPositionsZ.forEach((rz) => {
        const railMesh = new THREE.Mesh(railBoxGeo, railMaterial);
        railMesh.position.set(0, 0.02, rz);
        slopeGroup.add(railMesh);

        const railWire = new THREE.LineSegments(railEdgesGeo, railEdgeMaterial);
        railWire.position.copy(railMesh.position);
        slopeGroup.add(railWire);
      });

      // 2C. MODUŁY FOTOWOLTAICZNE Z WYRAŹNYMI DYLATACJAMI (PRZERWAMI)
      const moduleGeo = new THREE.BoxGeometry(modW, modThick, modH);
      const moduleEdgesGeo = new THREE.EdgesGeometry(moduleGeo);

      const cellGridGeo = new THREE.BufferGeometry();
      cellGridGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [
            0, modThick * 0.55, -modH * 0.48,
            0, modThick * 0.55, modH * 0.48,
            -modW * 0.48, modThick * 0.55, 0,
            modW * 0.48, modThick * 0.55, 0
          ],
          3
        )
      );
      const cellGridMat = new THREE.LineBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.42
      });

      for (let r = 0; r < rows; r++) {
        const mz = (r - (rows - 1) / 2) * (modH + gapZ);
        for (let c = 0; c < cols; c++) {
          const mx = (c - (cols - 1) / 2) * (modW + gapX);

          const modMesh = new THREE.Mesh(moduleGeo, pvCellMaterial);
          modMesh.position.set(mx, 0.095, mz);
          slopeGroup.add(modMesh);

          const modEdge = new THREE.LineSegments(moduleEdgesGeo, pvFrameEdgeMaterial);
          modEdge.position.copy(modMesh.position);
          slopeGroup.add(modEdge);

          const cellLines = new THREE.LineSegments(cellGridGeo, cellGridMat);
          cellLines.position.copy(modMesh.position);
          slopeGroup.add(cellLines);
        }
      }

      return tableGroup;
    }

    // Rozmieszczenie stołów PV w układzie rzeczywistej farmy fotowoltaicznej:
    // Dokładnie 2 rzędy po 3 stoły (łącznie 6 stołów), czyste równoległe rzędy z bezpiecznymi odstępami technologicznymi:
    // Rząd 1 (bliżej przodu): x: [-6.0, 0.0, 6.0], z: [8.0]
    // Rząd 2 (z tyłu): x: [-6.0, 0.0, 6.0], z: [1.0]
    const pvTablesList = [];
    const pvLayout = [
      // Rząd 1 (bliżej przodu, z = 8.0)
      { x: -6.0, z: 8.0, yaw: 0.0, cols: 4, scale: 0.90 },
      { x:  0.0, z: 8.0, yaw: 0.0, cols: 4, scale: 0.90 },
      { x:  6.0, z: 8.0, yaw: 0.0, cols: 4, scale: 0.90 },
      // Rząd 2 (z tyłu, z = 1.0)
      { x: -6.0, z: 1.0, yaw: 0.0, cols: 4, scale: 0.90 },
      { x:  0.0, z: 1.0, yaw: 0.0, cols: 4, scale: 0.90 },
      { x:  6.0, z: 1.0, yaw: 0.0, cols: 4, scale: 0.90 }
    ];

    pvLayout.forEach((cfg) => {
      const table = createDetailedPVTable(cfg.cols, 2);
      table.position.set(cfg.x, 0, cfg.z);
      table.rotation.y = cfg.yaw;
      table.scale.setScalar(cfg.scale);
      pvFarmGroup.add(table);
      pvTablesList.push({ mesh: table, x: cfg.x, z: cfg.z, yaw: cfg.yaw });
    });

    // =========================================================================
    // WIEŻA TELEKOMUNIKACYJNA BOT-3E (TRÓJKĄT RÓWNOBOCZNY, 3 STOPY, KRATOWNICA X)
    // Usytuowana na pierwszym planie, widoczna w całości bez przeszkód
    // =========================================================================
    const towerCoords = { x: 16.5, z: -7.0 };
    const towerTotalHeight = 25.5;

    function createBOT3ETower() {
      const towerGroup = new THREE.Group();

      const totalHeight = towerTotalHeight;
      const numTiers = 12;
      const taperTiers = 9;
      const baseRadius = 2.65;
      const topShaftRadius = 0.62;
      const foundationHeight = 0.95;

      const legAngles = [
        (25 * Math.PI) / 180,
        (145 * Math.PI) / 180,
        (265 * Math.PI) / 180
      ];

      function getTierHeight(tierIdx) {
        return foundationHeight + (tierIdx / numTiers) * (totalHeight - foundationHeight);
      }

      function getTierRadius(tierIdx) {
        if (tierIdx <= taperTiers) {
          const t = tierIdx / taperTiers;
          return baseRadius + (topShaftRadius - baseRadius) * t;
        } else {
          const t = (tierIdx - taperTiers) / (numTiers - taperTiers);
          return topShaftRadius * (1 - t * 0.08);
        }
      }

      function getCornerPos(tierIdx, legIdx) {
        const r = getTierRadius(tierIdx);
        const y = getTierHeight(tierIdx);
        const angle = legAngles[legIdx];
        return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
      }

      // 1. TRZY ŻELBETOWE STOPY FUNDAMENTOWE
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.7,
        metalness: 0.2
      });
      const concreteEdgeMat = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.9
      });

      const padBottomGeo = new THREE.BoxGeometry(1.35, 0.65, 1.35);
      const padBottomEdges = new THREE.EdgesGeometry(padBottomGeo);
      const pedestalGeo = new THREE.BoxGeometry(0.72, 1.0, 0.72);
      const pedestalEdges = new THREE.EdgesGeometry(pedestalGeo);

      for (let l = 0; l < 3; l++) {
        const baseCorner = getCornerPos(0, l);

        const padBottom = new THREE.Mesh(padBottomGeo, concreteMat);
        padBottom.position.set(baseCorner.x, 0.0, baseCorner.z);
        towerGroup.add(padBottom);

        const padWire = new THREE.LineSegments(padBottomEdges, concreteEdgeMat);
        padWire.position.copy(padBottom.position);
        towerGroup.add(padWire);

        const pedestal = new THREE.Mesh(pedestalGeo, concreteMat);
        pedestal.position.set(baseCorner.x, foundationHeight * 0.5, baseCorner.z);
        towerGroup.add(pedestal);

        const pedWire = new THREE.LineSegments(pedestalEdges, concreteEdgeMat);
        pedWire.position.copy(pedestal.position);
        towerGroup.add(pedWire);
      }

      // 2. TRZY GŁÓWNE KRAWĘŻNIKI NAROŻNE + KRATOWNICA
      const mainLegMaterial = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.45,
        metalness: 0.75,
        roughness: 0.25
      });

      function addCylinderStrut(p1, p2, radius, material) {
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        const cylGeo = new THREE.CylinderGeometry(radius, radius, len, 6);
        const mesh = new THREE.Mesh(cylGeo, material);
        mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        towerGroup.add(mesh);
      }

      const horizontalVertices = [];
      const diagonalVertices = [];

      for (let t = 0; t < numTiers; t++) {
        const legRadius = t < taperTiers ? 0.085 - (t / taperTiers) * 0.03 : 0.052;

        for (let l = 0; l < 3; l++) {
          const nextL = (l + 1) % 3;

          const bA = getCornerPos(t, l);
          const tA = getCornerPos(t + 1, l);
          const bB = getCornerPos(t, nextL);
          const tB = getCornerPos(t + 1, nextL);

          addCylinderStrut(bA, tA, legRadius, mainLegMaterial);

          horizontalVertices.push(bA.x, bA.y, bA.z, bB.x, bB.y, bB.z);
          if (t === numTiers - 1) {
            horizontalVertices.push(tA.x, tA.y, tA.z, tB.x, tB.y, tB.z);
          }

          diagonalVertices.push(
            bA.x, bA.y, bA.z, tB.x, tB.y, tB.z,
            bB.x, bB.y, bB.z, tA.x, tA.y, tA.z
          );

          if (t < 3) {
            const midA = new THREE.Vector3().lerpVectors(bA, tA, 0.5);
            const midB = new THREE.Vector3().lerpVectors(bB, tB, 0.5);
            horizontalVertices.push(midA.x, midA.y, midA.z, midB.x, midB.y, midB.z);
          }
        }
      }

      const horizGeo = new THREE.BufferGeometry();
      horizGeo.setAttribute('position', new THREE.Float32BufferAttribute(horizontalVertices, 3));
      towerGroup.add(
        new THREE.LineSegments(
          horizGeo,
          new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 })
        )
      );

      const diagGeo = new THREE.BufferGeometry();
      diagGeo.setAttribute('position', new THREE.Float32BufferAttribute(diagonalVertices, 3));
      towerGroup.add(
        new THREE.LineSegments(
          diagGeo,
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 })
        )
      );

      // 3. OŚ PIONOWOŚCI WIEŻY (Pion geodezyjny przez środek trójkąta równobocznego od podstawy aż po iglicę)
      const plumbAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, totalHeight + 3.2, 0)
      ]);
      const plumbAxisLine = new THREE.Line(
        plumbAxisGeo,
        new THREE.LineDashedMaterial({
          color: 0xfde047,
          dashSize: 0.5,
          gapSize: 0.3,
          transparent: true,
          opacity: 0.65
        })
      );
      plumbAxisLine.computeLineDistances();
      towerGroup.add(plumbAxisLine);

      // 4. ANTENY SEKTOROWE, RADIOLINIA I CZUBEK WIEŻY (PUNKT CELOWANIA TACHIMETRU)
      const topY = totalHeight;
      const antennaMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.5,
        roughness: 0.3
      });

      const sectorGeo = new THREE.BoxGeometry(0.22, 2.2, 0.14);
      for (let l = 0; l < 3; l++) {
        const topCorner = getCornerPos(numTiers - 1, l);
        const angle = legAngles[l];
        const sector = new THREE.Mesh(sectorGeo, antennaMat);
        sector.position.set(
          topCorner.x + Math.cos(angle) * 0.22,
          topY - 1.1,
          topCorner.z + Math.sin(angle) * 0.22
        );
        sector.rotation.y = -angle;
        towerGroup.add(sector);
      }

      const dishGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.22, 16);
      dishGeo.rotateX(Math.PI / 2);
      const dish = new THREE.Mesh(dishGeo, antennaMat);
      dish.position.set(0.55, topY - 3.6, 0.35);
      dish.rotation.y = 0.4;
      towerGroup.add(dish);

      const spireGeo = new THREE.CylinderGeometry(0.03, 0.06, 2.5, 8);
      const spire = new THREE.Mesh(spireGeo, antennaMat);
      spire.position.set(0, topY + 1.25, 0);
      towerGroup.add(spire);

      // Czubek wieży (głowica pomiarowa / światło przeszkodowe + celownik pryzmatyczny dla tachimetru)
      const apexHeight = topY + 2.5;
      const beaconGeo = new THREE.SphereGeometry(0.28, 14, 14);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
      const topBeacon = new THREE.Mesh(beaconGeo, beaconMat);
      topBeacon.position.set(0, apexHeight, 0);
      towerGroup.add(topBeacon);

      // Holograficzny celownik geodezyjny na czubku wieży (wskazywany przez tachimetr)
      const targetReticleGroup = new THREE.Group();
      targetReticleGroup.position.set(0, apexHeight, 0);
      const reticleOuter = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        })
      );
      const reticleInner = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 0.95, 24),
        new THREE.MeshBasicMaterial({
          color: 0xfde047,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75
        })
      );
      targetReticleGroup.add(reticleOuter, reticleInner);
      towerGroup.add(targetReticleGroup);

      return {
        group: towerGroup,
        topBeacon,
        targetReticleGroup,
        apexLocalY: apexHeight,
        midCheckLocalY: totalHeight * 0.68,
        lowCheckLocalY: totalHeight * 0.36
      };
    }

    const bot3e = createBOT3ETower();
    bot3e.group.position.set(towerCoords.x, 0, towerCoords.z);
    worldGroup.add(bot3e.group);

    // =========================================================================
    // GEODETA Z TACHIMETREM PO LEWEJ STRONIE WIEŻY (POMIAR PIONOWOŚCI WIEŻY BOT-3E)
    // =========================================================================
    // Pozycja na grzbiecie widokowym po lewej stronie, bezkolizyjna linia celowania w czubek wieży
    const surveyorCoords = { x: 0.5, z: -14.0 };

    function createSurveyorStation() {
      const stationGroup = new THREE.Group();

      // 1. Punkt osnowy stanowiskowej pod statywem (świecący pierścień geodezyjny na gruncie)
      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 1.05, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        })
      );
      baseRing.position.y = 0.05;
      stationGroup.add(baseRing);

      const innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.42, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95
        })
      );
      innerRing.position.y = 0.06;
      stationGroup.add(innerRing);

      // 2. STATYW GEODEZYJNY (3 rozstawione nogi teleskopowe + trójkątna głowica)
      const tripodHeadY = 1.65;
      const tripodSpreadRadius = 0.72;
      const tripodLegMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.55,
        metalness: 0.4,
        roughness: 0.3
      });

      for (let i = 0; i < 3; i++) {
        const angle = (i * 120 + 15) * (Math.PI / 180);
        const footPos = new THREE.Vector3(
          Math.cos(angle) * tripodSpreadRadius,
          -0.15,
          Math.sin(angle) * tripodSpreadRadius
        );
        const headEdgePos = new THREE.Vector3(
          Math.cos(angle) * 0.14,
          tripodHeadY,
          Math.sin(angle) * 0.14
        );

        const legDir = new THREE.Vector3().subVectors(headEdgePos, footPos);
        const legLen = legDir.length();
        const legGeo = new THREE.CylinderGeometry(0.035, 0.025, legLen, 6);
        const legMesh = new THREE.Mesh(legGeo, tripodLegMat);
        legMesh.position.copy(footPos).add(headEdgePos).multiplyScalar(0.5);
        legMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), legDir.clone().normalize());
        stationGroup.add(legMesh);
      }

      // Głowica statywu i spodarka
      const headPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.24, 0.1, 6),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
      );
      headPlate.position.y = tripodHeadY;
      stationGroup.add(headPlate);

      // 3. TACHIMETR ELEKTRONICZNY (Alidada + Luneta celownicza obracana w stronę czubka wieży)
      const instrumentGroup = new THREE.Group();
      instrumentGroup.position.set(0, tripodHeadY + 0.24, 0);
      stationGroup.add(instrumentGroup);

      // Korpus alidady (złoto-błękitny instrument pomiarowy)
      const alidadeGeo = new THREE.BoxGeometry(0.34, 0.38, 0.28);
      const alidadeMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.2
      });
      const alidade = new THREE.Mesh(alidadeGeo, alidadeMat);
      alidade.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(alidadeGeo),
          new THREE.LineBasicMaterial({ color: 0xfef08a })
        )
      );
      instrumentGroup.add(alidade);

      // Luneta celownicza tachimetru (pochylana pionowo na czubek wieży)
      const telescopeGroup = new THREE.Group();
      telescopeGroup.position.set(0, 0.08, 0);
      instrumentGroup.add(telescopeGroup);

      const scopeBarrelGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.48, 12);
      scopeBarrelGeo.rotateX(Math.PI / 2); // Oś lunety wzdłuż +Z lokalnego
      const scopeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const scopeBarrel = new THREE.Mesh(scopeBarrelGeo, scopeMat);
      telescopeGroup.add(scopeBarrel);

      // Świecąca soczewka obiektywu tachimetru
      const lensGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
      );
      lensGlow.position.set(0, 0, 0.25);
      telescopeGroup.add(lensGlow);

      // 4. SYLWETKA GEODETY (w stylistyce technicznej CAD/Wireframe stojącego za tachimetrem)
      const surveyorFigure = new THREE.Group();
      // Ustawienie geodety tuż za statywem (od strony przeciwnej niż wieża)
      surveyorFigure.position.set(-0.62, 0, 0.18);
      surveyorFigure.rotation.y = Math.PI / 2;
      stationGroup.add(surveyorFigure);

      const figureSolidMat = new THREE.MeshStandardMaterial({
        color: 0x0c2444,
        emissive: 0x075985,
        emissiveIntensity: 0.55,
        roughness: 0.4
      });
      const figureWireMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.92
      });
      const vestWireMat = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.98
      });

      // Nogi geodety
      const legGeoFig = new THREE.BoxGeometry(0.16, 0.95, 0.18);
      const leftLeg = new THREE.Mesh(legGeoFig, figureSolidMat);
      leftLeg.position.set(-0.13, 0.45, 0);
      leftLeg.add(new THREE.LineSegments(new THREE.EdgesGeometry(legGeoFig), figureWireMat));
      surveyorFigure.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeoFig, figureSolidMat);
      rightLeg.position.set(0.13, 0.45, 0);
      rightLeg.add(new THREE.LineSegments(new THREE.EdgesGeometry(legGeoFig), figureWireMat));
      surveyorFigure.add(rightLeg);

      // Tułów geodety (w kamizelce ostrzegawczej ze złotym obrysem CAD)
      const torsoGeo = new THREE.BoxGeometry(0.46, 0.78, 0.26);
      const torso = new THREE.Mesh(torsoGeo, figureSolidMat);
      torso.position.set(0, 1.32, 0);
      torso.add(new THREE.LineSegments(new THREE.EdgesGeometry(torsoGeo), vestWireMat));
      surveyorFigure.add(torso);

      // Paski odblaskowe kamizelki geodezyjnej
      const stripeGeo = new THREE.BoxGeometry(0.48, 0.06, 0.28);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
      stripe1.position.set(0, 1.18, 0);
      const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
      stripe2.position.set(0, 1.42, 0);
      surveyorFigure.add(stripe1, stripe2);

      // Głowa i kask ochronny (żółto-złoty kask inżynieryjny)
      const headGeo = new THREE.SphereGeometry(0.16, 10, 10);
      const head = new THREE.Mesh(headGeo, figureSolidMat);
      head.position.set(0, 1.88, 0);
      head.add(new THREE.LineSegments(new THREE.EdgesGeometry(headGeo), figureWireMat));
      surveyorFigure.add(head);

      const helmetGeo = new THREE.CylinderGeometry(0.17, 0.21, 0.14, 10);
      const helmet = new THREE.Mesh(helmetGeo, stripeMat);
      helmet.position.set(0, 1.96, 0.02);
      surveyorFigure.add(helmet);

      // Ramię geodety wyciągnięte do śruby leniwki tachimetru
      const armGeo = new THREE.BoxGeometry(0.13, 0.13, 0.52);
      const rightArm = new THREE.Mesh(armGeo, figureSolidMat);
      rightArm.position.set(0.28, 1.56, 0.22);
      rightArm.rotation.x = -0.25;
      rightArm.add(new THREE.LineSegments(new THREE.EdgesGeometry(armGeo), figureWireMat));
      surveyorFigure.add(rightArm);

      return {
        group: stationGroup,
        instrumentGroup,
        telescopeGroup,
        baseRing,
        lensLocalHeight: tripodHeadY + 0.32
      };
    }

    const surveyorStation = createSurveyorStation();
    surveyorStation.group.position.set(surveyorCoords.x, 0, surveyorCoords.z);
    worldGroup.add(surveyorStation.group);

    // =========================================================================
    // WIĄZKA POMIARU PIONOWOŚCI WIEŻY (LASER TACHIMETRU -> CZUBEK WIEŻY BOT-3E)
    // =========================================================================
    // 1. Główna wiązka celowa dalmierza (od obiektywu tachimetru prosto w czubek wieży)
    const laserMainGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    const laserMainLine = new THREE.Line(
      laserMainGeo,
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.95
      })
    );
    worldGroup.add(laserMainLine);

    // 2. Pomocnicze celowe kontrolne (pomiar pionowości na 2 niższych poziomach sekcji wieży)
    const laserCheckGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    const laserCheckLines = new THREE.LineSegments(
      laserCheckGeo,
      new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.42
      })
    );
    worldGroup.add(laserCheckLines);

    // 3. Impulsy pomiarowe EDM wędrujące wzdłuż wiązki z tachimetru na czubek wieży
    const edmPulses = [];
    const pulseGeo = new THREE.SphereGeometry(0.18, 10, 10);
    for (let p = 0; p < 3; p++) {
      const pulseMat = new THREE.MeshBasicMaterial({
        color: p % 2 === 0 ? 0x7dd3fc : 0xfef08a
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      worldGroup.add(pulseMesh);
      edmPulses.push({ mesh: pulseMesh, offset: p / 3 });
    }

    // =========================================================================
    // OŚWIETLENIE BŁĘKITNO-ZŁOTE (BLUE-GOLD PREMIUM LIGHTING)
    // =========================================================================
    const ambientLight = new THREE.AmbientLight(0x132a52, 1.8);
    scene.add(ambientLight);

    const goldLight = new THREE.DirectionalLight(0xf59e0b, 2.6);
    goldLight.position.set(35, 45, 24);
    scene.add(goldLight);

    const cyanLight = new THREE.PointLight(0x0ea5e9, 3.5, 120);
    cyanLight.position.set(-28, 22, 18);
    scene.add(cyanLight);

    const towerSpotlight = new THREE.PointLight(0xfbbf24, 3.2, 75);
    towerSpotlight.position.set(16.5, 22, -3);
    worldGroup.add(towerSpotlight);

    // =========================================================================
    // AKTUALIZACJA GEOMETRII W KAŻDEJ KLATCE
    // =========================================================================
    const colorDeepBlue = new THREE.Color(0x072a52);
    const colorTechCyan = new THREE.Color(0x0ea5e9);
    const colorWarmGold = new THREE.Color(0xf59e0b);
    const colorBrightGold = new THREE.Color(0xfef08a);
    const tempColor = new THREE.Color();

    const startPointVec = new THREE.Vector3();
    const apexPointVec = new THREE.Vector3();
    const midCheckVec = new THREE.Vector3();
    const lowCheckVec = new THREE.Vector3();
    const aimDirVec = new THREE.Vector3();
    const targetLookVec = new THREE.Vector3();
    let frameCounter = 0;

    function updateSceneGeometry(time) {
      const positions = geometry.attributes.position;
      const colorAttr = geometry.attributes.color;

      for (let i = 0; i < vertexCount; i++) {
        const bx = basePositions[i * 2];
        const bz = basePositions[i * 2 + 1];

        const y = getDynamicWaves(bx, bz, time) * vertexStaticFactor[i] + vertexStaticOffset[i];
        positions.setY(i, y);

        // Wysokość znormalizowana: od dolin (-4.7 m) po szczyty połonin (+9.1 m)
        const normH = Math.max(0, Math.min(1, (y + 4.7) / 13.8));

        // Spójna kolorystyka połonin: głęboki błękit dolin -> techniczny cyjan stoków -> ciepłe złoto grzbietów
        if (normH < 0.38) {
          tempColor.lerpColors(colorDeepBlue, colorTechCyan, normH / 0.38);
        } else if (normH < 0.72) {
          tempColor.lerpColors(colorTechCyan, colorWarmGold, (normH - 0.38) / 0.34);
        } else {
          tempColor.lerpColors(colorWarmGold, colorBrightGold, (normH - 0.72) / 0.28);
        }

        colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
      }

      positions.needsUpdate = true;
      colorAttr.needsUpdate = true;
      if (staticMode || frameCounter === 0 || frameCounter % 4 === 0) {
        geometry.computeVertexNormals();
      }
      frameCounter++;

      // 1. Posadowienie stołów PV wraz z dopasowaniem do lokalnego nachylenia stoku
      pvTablesList.forEach((item) => {
        const ty = getTerrainElevation(item.x, item.z, time);
        item.mesh.position.y = ty;

        const dx = Math.cos(item.yaw) * 3.0;
        const dz = -Math.sin(item.yaw) * 3.0;
        const yLeft = getTerrainElevation(item.x - dx, item.z - dz, time);
        const yRight = getTerrainElevation(item.x + dx, item.z + dz, time);
        const rollAngle = Math.atan2(yRight - yLeft, 6.0);
        item.mesh.rotation.z = rollAngle * 0.85;
      });

      // 2. Posadowienie wieży telekomunikacyjnej BOT-3E
      const towerY = getTerrainElevation(towerCoords.x, towerCoords.z, time);
      bot3e.group.position.y = towerY;

      const beaconPulse = 0.7 + 0.3 * Math.sin(time * 3.2);
      bot3e.targetReticleGroup.scale.setScalar(0.95 + beaconPulse * 0.35);
      bot3e.targetReticleGroup.lookAt(camera.position);

      // 3. Posadowienie stanowiska geodety z tachimetrem po lewej stronie wieży
      const survY = getTerrainElevation(surveyorCoords.x, surveyorCoords.z, time);
      surveyorStation.group.position.y = survY;
      surveyorStation.baseRing.scale.setScalar(1 + Math.sin(time * 2.5) * 0.15);

      // 4. Wycelowanie lunety tachimetru i wiązki laserowej dokładnie w czubek wieży BOT-3E
      startPointVec.set(
        surveyorCoords.x,
        survY + surveyorStation.lensLocalHeight,
        surveyorCoords.z
      );
      apexPointVec.set(
        towerCoords.x,
        towerY + bot3e.apexLocalY,
        towerCoords.z
      );
      midCheckVec.set(
        towerCoords.x,
        towerY + bot3e.midCheckLocalY,
        towerCoords.z
      );
      lowCheckVec.set(
        towerCoords.x,
        towerY + bot3e.lowCheckLocalY,
        towerCoords.z
      );

      aimDirVec.subVectors(apexPointVec, startPointVec);
      const horizDist = Math.sqrt(aimDirVec.x * aimDirVec.x + aimDirVec.z * aimDirVec.z);
      const yawToTower = Math.atan2(aimDirVec.x, aimDirVec.z);
      const pitchToApex = -Math.atan2(aimDirVec.y, horizDist);

      surveyorStation.instrumentGroup.rotation.y = yawToTower;
      surveyorStation.telescopeGroup.rotation.x = pitchToApex;

      const mainPos = laserMainGeo.attributes.position;
      mainPos.setXYZ(0, startPointVec.x, startPointVec.y, startPointVec.z);
      mainPos.setXYZ(1, apexPointVec.x, apexPointVec.y, apexPointVec.z);
      mainPos.needsUpdate = true;

      const checkPos = laserCheckGeo.attributes.position;
      checkPos.setXYZ(0, startPointVec.x, startPointVec.y, startPointVec.z);
      checkPos.setXYZ(1, midCheckVec.x, midCheckVec.y, midCheckVec.z);
      checkPos.setXYZ(2, startPointVec.x, startPointVec.y, startPointVec.z);
      checkPos.setXYZ(3, lowCheckVec.x, lowCheckVec.y, lowCheckVec.z);
      checkPos.needsUpdate = true;

      edmPulses.forEach((p) => {
        const progress = (time * 0.48 + p.offset) % 1;
        p.mesh.position.lerpVectors(startPointVec, apexPointVec, progress);
      });
    }

    // =========================================================================
    // RESPONSYWNA INTERAKCJA Z MYSZKĄ (BEZ BLOKOWANIA SKROLOWANIA DOTYKOWEGO)
    // =========================================================================
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    function handlePointerMove(clientX, clientY) {
      targetMouseX = (clientX / cachedWidth - 0.5) * 2;
      targetMouseY = (clientY / cachedHeight - 0.5) * 2;
    }

    window.addEventListener('mousemove', (e) => {
      if (!isMobileViewport) {
        handlePointerMove(e.clientX, e.clientY);
      }
    }, { passive: true });

    let viewMode = 0;
    const modeBtn = document.getElementById('hero-3d-mode-btn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        viewMode = (viewMode + 1) % 3;
        if (viewMode === 0) {
          wireframeMaterial.opacity = 0.58;
          pointsMesh.visible = true;
          solidMesh.visible = true;
          modeBtn.textContent = 'Tryb 3D: NMT + Farma PV + BOT-3E';
        } else if (viewMode === 1) {
          wireframeMaterial.opacity = 0.68;
          pointsMesh.visible = true;
          solidMesh.visible = true;
          modeBtn.textContent = 'Tryb 3D: Zbliżenie (Stoły PV & Pomiar Wieży)';
        } else {
          wireframeMaterial.opacity = 0.88;
          pointsMesh.visible = false;
          solidMesh.visible = false;
          modeBtn.textContent = 'Tryb 3D: Siatka CAD Wireframe';
        }
        // Smartfon: po zmianie trybu odrysowujemy jedną statyczną klatkę
        if (staticMode) {
          renderStaticMobileFrame();
        }
      });
    }

    const coordsHud = document.getElementById('hud-live-coords');
    const clock = new THREE.Clock();
    let isHeroVisible = true;
    let lastFrameTime = 0;
    let lastHudUpdate = 0;

    // Automatyczne wstrzymywanie renderowania WebGL gdy sekcja Hero zniknie z ekranu podczas skrolowania
    const heroSection = container.closest('.hero-3d-wrapper') || container;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isHeroVisible = entry.isIntersecting;
        });
      }, { threshold: 0.01 });
      observer.observe(heroSection);
    }

    // =========================================================================
    // SMARTFONY (< 768px): STATYCZNY, OSTRY KADR (ODDALENIE + CAŁA WIEŻA I GEODETA)
    // - Wyłączenie pętli animacji i paralaksy (0% lagów / brak obciążenia GPU)
    // - Precyzyjny kadr z dynamiczną blokadą kąta hFOV: cała wieża teletechniczna
    //   BOT-3E (od stóp fundamentu po szpic iglicy, anteny i czerwone światło) oraz
    //   geodeta celujący tachimetrem mieszczą się w całości w kadrze bez ucinania krawędzi.
    // - Renderowanie w natywnej gęstości pikseli (do 2x Retina) z antyaliasingiem
    // =========================================================================
    const STATIC_SCENE_TIME = 6.0;

    function renderStaticMobileFrame() {
      cachedWidth = container.clientWidth || window.innerWidth;
      cachedHeight = container.clientHeight || 560;

      // Pełna gęstość pikseli (Retina / OLED do 2x) = idealnie ostre linie siatki bez lagów
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(cachedWidth, cachedHeight);

      // Statyczna pozycja świata – brak dryfu i kołysania
      worldGroup.rotation.set(0, baseYaw, 0);

      // Obliczenie geometrii terenu, instrumentu i laserów dla ustalonego czasu
      updateSceneGeometry(STATIC_SCENE_TIME);
      worldGroup.updateMatrixWorld(true);

      const aspect = cachedWidth / cachedHeight;
      camera.aspect = aspect;

      // Dynamiczne dopasowanie FOV z blokadą hFOV:
      // Zapobiega sztucznemu powiększeniu i ucięciu boków na wąskich ekranach smartfonów
      const targetHalfHFov = Math.atan(Math.tan((56.0 * Math.PI / 180.0) / 2.0) * 0.45);
      const clampedAsp = Math.min(aspect, 0.55);
      camera.fov = Math.max(48.0, Math.min(72.0, 2.0 * Math.atan(Math.tan(targetHalfHFov) / clampedAsp) * (180.0 / Math.PI)));

      // Oddalona pozycja kamery obejmująca w całości wieżę i stanowisko geodety na grzbiecie połoniny
      camera.position.set(12.0, 16.0, 58.0);
      cameraTarget.set(15.0, 15.0, -7.0);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();

      // Przejrzysta mgła przestrzenna zapewniająca wysoki kontrast i głębię
      scene.fog.density = 0.0052;
      bot3e.targetReticleGroup.lookAt(camera.position);

      renderer.render(scene, camera);
    }

    function leaveStaticMode() {
      staticMode = false;
      scene.fog.density = 0.008;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(cachedWidth, cachedHeight);
      camera.fov = 48;
      camera.position.set(12.0, 15.5, 54.0);
      cameraTarget.set(16.0, 14.5, -7.0);
      camera.aspect = cachedWidth / cachedHeight;
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
      if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(animate);
      }
    }

    // =========================================================================
    // DESKTOP / TABLET: PŁYNNA ANIMACJA (BEZ ZMIAN)
    // =========================================================================
    let loopRunning = false;

    function animate(now) {
      if (staticMode) {
        loopRunning = false;
        return;
      }
      requestAnimationFrame(animate);

      if (!isHeroVisible || document.hidden) return;

      const elapsedTime = clock.getElapsedTime();

      currentMouseX += (targetMouseX - currentMouseX) * 0.085;
      currentMouseY += (targetMouseY - currentMouseY) * 0.085;

      updateSceneGeometry(elapsedTime);

      const slowDriftYaw = Math.sin(elapsedTime * 0.08) * 0.05;
      worldGroup.rotation.y = baseYaw + slowDriftYaw + currentMouseX * 0.48;
      worldGroup.rotation.x = currentMouseY * 0.22;

      if (viewMode === 1) {
        camera.position.x += (13.5 + currentMouseX * 5 - camera.position.x) * 0.05;
        camera.position.y += (14.5 - currentMouseY * 3.0 - camera.position.y) * 0.05;
        camera.position.z += (34.0 - camera.position.z) * 0.05;
        targetLookVec.set(16.0, 14.5, -7.0);
        cameraTarget.lerp(targetLookVec, 0.05);
      } else {
        camera.position.x += (12.0 + currentMouseX * 7.5 - camera.position.x) * 0.06;
        camera.position.y += (15.5 - currentMouseY * 4.0 - camera.position.y) * 0.06;
        camera.position.z += (54.0 - camera.position.z) * 0.06;
        targetLookVec.set(16.0 + currentMouseX * 3, 14.5 - currentMouseY * 2.0, -7.0);
        cameraTarget.lerp(targetLookVec, 0.06);
      }
      camera.lookAt(cameraTarget);

      // Współrzędne geodezyjne lokalizacji biura GEODEO (PL-2000)
      if (coordsHud && coordsHud.textContent !== 'PL-2000 X: 5486490.47 | Y: 7582675.88 | H: 341.00 m n.p.m.') {
        coordsHud.textContent = 'PL-2000 X: 5486490.47 | Y: 7582675.88 | H: 341.00 m n.p.m.';
      }

      renderer.render(scene, camera);
    }

    if (staticMode) {
      // Dwie klatki opóźnienia = gotowy układ strony; ponowny kadr po wczytaniu fontów i obrazów
      requestAnimationFrame(() => requestAnimationFrame(renderStaticMobileFrame));
      window.addEventListener('load', () => { if (staticMode) renderStaticMobileFrame(); });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { if (staticMode) renderStaticMobileFrame(); });
      }
    } else {
      loopRunning = true;
      requestAnimationFrame(animate);
    }

    let resizeTimer;
    let lastStaticW = 0;
    let lastStaticH = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!container) return;
        cachedWidth = container.clientWidth || window.innerWidth;
        cachedHeight = container.clientHeight || 560;
        isMobileViewport = cachedWidth < 768;

        if (isMobileViewport) {
          staticMode = true;
          // Pasek adresu przeglądarki mobilnej wywołuje resize przy skrolowaniu – odrysowujemy tylko przy realnej zmianie wymiarów (np. obrót ekranu)
          if (cachedWidth !== lastStaticW || Math.abs(cachedHeight - lastStaticH) > 80) {
            lastStaticW = cachedWidth;
            lastStaticH = cachedHeight;
            renderStaticMobileFrame();
          }
          return;
        }

        if (staticMode) {
          leaveStaticMode();
          return;
        }

        camera.aspect = cachedWidth / cachedHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(cachedWidth, cachedHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }, 150);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGeodeoTerrain3D);
  } else {
    initGeodeoTerrain3D();
  }
})();
