
var Map = function(parentDiv) {

    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

    var osmCycle = L.tileLayer('http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png');
    var osmCycleTransport = L.tileLayer('http://{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png');
    var toner = L.tileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png');
    var watercolor = L.tileLayer('http://{s}.tile.stamen.com/watercolor/{z}/{x}/{y}.jpg');

    this.layerPokestops = new L.LayerGroup();
    this.layerCatches = new L.LayerGroup();
    this.layerPath = new L.LayerGroup();

    this.map = L.map(parentDiv, {
        layers: [osm, this.layerPokestops, this.layerCatches, this.layerPath]
    });

   var baseLayers = {
        "OpenStreetMap": osm,
        "OpenCycleMap": osmCycle,
        "OpenCycleMap Transport": osmCycleTransport,
        "Toner": toner,
        "Watercolor": watercolor,
    };
    var overlays = {
        "Path": this.layerPath,
        "Pokestops": this.layerPokestops,
        "Catches": this.layerCatches
    };

    L.control.layers(baseLayers, overlays).addTo(this.map);

    this.path = null;

    this.steps = [];
    this.catches = [];
    this.pokestops = [];
    this.availablePokestops = [];
    this.pokemonList = [];
};

Map.prototype.saveContext = function() {
    sessionStorage.setItem("available", true);
    sessionStorage.setItem("steps", JSON.stringify(this.steps));
    sessionStorage.setItem("catches", JSON.stringify(this.catches));
    sessionStorage.setItem("pokestops", JSON.stringify(this.pokestops));
}

Map.prototype.loadContext = function() {
    try {
        if (sessionStorage.getItem("available") == "true") {
            console.log("Load data from storage to restore session");

            this.steps = JSON.parse(sessionStorage.getItem("steps")) || [];
            this.catches = JSON.parse(sessionStorage.getItem("catches")) || [];
            this.pokestops = JSON.parse(sessionStorage.getItem("pokestops")) || [];

            if (this.steps.length > 0) this.initPath();

            for (var i = 0; i < this.pokestops.length; i++) {
                var pt = this.pokestops[i];
                var icon = L.icon({ iconUrl: `./assets/img/pokestop.png`, iconSize: [30, 50]});
                L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).bindPopup(pt.name).addTo(this.layerPokestops);
            }

            for (var i = 0; i < this.catches.length; i++) {
                var pt = this.catches[i];
                var icon = L.icon({ iconUrl: `./assets/pokemon/${pt.id}.png`, iconSize: [50, 50], iconAnchor: [20, 20]});
                //var pkm = `${pt.name} (lvl ${pt.lvl}) <br /> Cp:${pt.cp} Iv:${pt.iv}%`;
                var pkm = `${pt.name} <br /> Cp:${pt.cp} Iv:${pt.iv}%`;
                L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 100}).bindPopup(pkm).addTo(this.layerCatches);
            }

            sessionStorage.setItem("available", false);
        }
    } catch(err) { console.log(err); }
}

Map.prototype.initPath = function() {
    if (this.path != null) return true;

    if (!this.me) {
        this.map.setView([this.steps[0].lat, this.steps[0].lng], 16);
        this.me = L.marker([this.steps[0].lat, this.steps[0].lng], { zIndexOffset: 200 }).addTo(this.map).bindPopup(`${this.steps[0].lat.toFixed(4)},${this.steps[0].lng.toFixed(4)}`);
        $(".loading").hide();
    }

    if (this.steps.length >= 2) {
        var pts = Array.from(this.steps, pt => L.latLng(pt.lat, pt.lng));
        this.path = L.polyline(pts, { color: 'red' }).addTo(this.layerPath);
        return true;
    }

    return false;
}

Map.prototype.addToPath = function(pt) {
    this.steps.push(pt);
    if (this.initPath()) {
        var latLng = L.latLng(pt.lat, pt.lng);
        this.path.addLatLng(latLng);
        this.me.setLatLng(latLng).getPopup().setContent(`${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`);
        if (global.config.followPlayer) {
            this.map.panTo(latLng, true);
        }
    }
}

Map.prototype.addCatch = function(pt) {
    if (!pt.lat) {
        if (this.steps.length <= 0) return;
        var last = this.steps.pop();
        pt.lat = last.lat;
        pt.lng = last.lng;
    }

    //var pkm = `${pt.name} (lvl ${pt.lvl}) <br /> Cp:${pt.cp} Iv:${pt.iv}%`;
    var pkm = `${pt.name}<br /> CP:${pt.cp} IV:${pt.iv}%`;

    this.catches.push(pt);

    var icon = L.icon({ iconUrl: `./assets/pokemon/${pt.id}.png`, iconSize: [50, 50], iconAnchor: [25, 25] });
    L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 100 }).bindPopup(pkm).addTo(this.layerCatches);
}

Map.prototype.addVisitedPokestop = function(pt) {
    if (!pt.lat) return;

    this.pokestops.push(pt);

    var ps = this.availablePokestops.find(ps => ps.id == pt.id);
    if (ps) {
        ps.marker.setIcon(L.icon({ iconUrl: `./assets/img/pokestop.png`, iconSize: [30, 50]}));
        if (pt.name) ps.marker.bindPopup(pt.name);
    } else {
        var icon = L.icon({ iconUrl: `./assets/img/pokestop.png`, iconSize: [30, 50]});
        var marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50});
        if (pt.name) marker.bindPopup(pt.name);
        marker.addTo(this.layerPokestops);
    }
}

Map.prototype.addPokestops = function(forts) {
    for(var i = 0; i < forts.length; i++) {
        var pt = forts[i];
        var ps = this.availablePokestops.find(ps => ps.id == pt.id);
        if (!ps) {
            var iconurl = pt.cooldown_timestamp_ms != null  ? `./assets/img/pokestop.png` : `./assets/img/pokestop_available.png`;
            var icon = L.icon({ iconUrl: iconurl, iconSize: [30, 50]});
            pt.marker = L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 50}).addTo(this.layerPokestops);
            this.availablePokestops.push(pt);
        } else if (ps.cooldown_timestamp_ms != null) {
            ps.marker.setIcon(L.icon({ iconUrl: `./assets/img/pokestop.png`, iconSize: [30, 50]}));
        }
    }
}

Map.prototype.displayPokemonList = function(all, sortBy) {
    console.log("Pokemon list");
    global.active = "pokemon";
    this.pokemonList = all || this.pokemonList;
    if (!sortBy) {
        sortBy = localStorage.getItem("sortPokemonBy") || "cp";
    } else {
        localStorage.setItem("sortPokemonBy", sortBy);
    }

    if (sortBy == "pokemonId") {
        this.pokemonList = this.pokemonList.sort((p1, p2) => p1[sortBy] - p2[sortBy]);
    } else {
        this.pokemonList = this.pokemonList.sort((p1, p2) => p2[sortBy] - p1[sortBy]);
    }

    $(".inventory .numberinfo").text(`${this.pokemonList.length}/${global.storage.pokemon}`);
    var div = $(".inventory .data");
    div.html(``);
    this.pokemonList.forEach(function(elt) {
        var canEvolve = elt.canEvolve && !elt.inGym && elt.candy >= elt.candyToEvolve;
        var evolveStyle = canEvolve ? "" : "style='display:none'";
        var evolveClass = canEvolve ? "canEvolve" : "";
        var transferStyle = elt.favorite ? "style='display:none'" : "";
        div.append(`
            <div class="pokemon">
                <div class="transfer" id='${elt.id}'>
                    <a title='Transfer' href="#" class="transferAction ${transferStyle}"><img src="./assets/img/recyclebin.png" /></a>
                    <a title='Evolve' href="#" class="evolveAction" ${evolveStyle}><img src="./assets/img/evolve.png" /></a>
                </div>
                <span class="info">CP: <strong>${elt.cp}</strong> IV: <strong>${elt.iv}%</strong></span>
                <span class="info">Candy: ${elt.candy}<span ${evolveStyle}>/${elt.candyToEvolve}</span></span>
                <span class="imgspan ${evolveClass}"><img src="./assets/pokemon/${elt.pokemonId}.png" /></span>
                <span class="name">${elt.name}</span>
            </div>
        `);
    });
    $(".pokemonsort").show();
    $(".inventory").show().addClass("active");
}

Map.prototype.displayEggsList = function(eggs) {
    console.log("Eggs list");
    console.log(eggs);
    global.active = "eggs";
    $(".inventory .sort").hide();
    $(".inventory .numberinfo").text(eggs.length + "/9");
    var div = $(".inventory .data")
    div.html("");
    eggs.forEach(function(elt) {
        if (elt) {
            div.append(`
                <div class="eggs">
                    <span class="imgspan"><img src="./assets/inventory/${elt.type}.png" /></span>
                    <span>${elt.doneDist.toFixed(1)} / ${elt.totalDist.toFixed(1)} km</span>
                </div>
            `);
        }
    });
    $(".inventory").show().addClass("active");
}

Map.prototype.displayInventory = function(items) {
    console.log("Inventory list");
    global.active = "inventory";
    $(".inventory .sort").hide();
    var count = items.filter(i => i.item_id != 901).reduce((prev, cur) => prev + cur.count, 0);
    $(".inventory .numberinfo").text(`${count}/${global.storage.items}`);
    var div = $(".inventory .data")
    div.html(``);
    items.forEach(function(elt) {
        div.append(`
            <div class="items">
                <span>x${elt.count}</span>
                <span class="imgspan"><img src="./assets/inventory/${elt.item_id}.png" /></span>
                <span class="info">${elt.name}</span>
            </div>
        `);
    });
    $(".inventory").show().addClass("active");
}