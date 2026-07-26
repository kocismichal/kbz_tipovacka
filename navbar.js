const navbarHTML = `
<nav class="main-navbar">
    <a href="index.html" class="nav-home-btn" title="Domů">
        <i class="fas fa-home"></i>
    </a>
    <div class="nav-center-wrap">
        <div class="nav-group">
            <span class="nav-group-title">Aktivní tipovačky</span>
            <div class="nav-group-links">
                <a href="2627_formchanceliga.html" class="nav-tile chance-color">TIP CHL</a>
                <a href="2627_formchancenarodniliga.html" class="nav-tile chnl-color">TIP CHNL</a>
                <a href="2627_prehled_chance.html" class="nav-tile chance-color">PŘEHLED CHL</a>
                <a href="2627_prehled_chnl.html" class="nav-tile chnl-color">PŘEHLED CHNL</a>
            </div>
        </div>
        <div class="nav-separator"></div>
        <div class="nav-group">
            <span class="nav-group-title">Vyhodnocené soutěže</span>
            <div class="nav-group-links">
                <a href="2526_chanceliga.html" class="nav-tile chance-color">CHL</a>
                <a href="2526_chnl.html" class="nav-tile chnl-color">CHNL</a>
            </div>
        </div>
    </div>
    <div class="nav-right-wrap">
        <a href="https://discord.gg/p8WEPtjahD" target="_blank" class="nav-discord-btn"><i class="fab fa-discord"></i> KBZ DISCORD</a>
        <a href="https://www.kudybezizajic.com/" target="_blank" class="nav-shop-btn"><i class="fas fa-shopping-cart"></i> KBZ SHOP</a>
    </div>
</nav>
`;

// Tento kód po načtení stránky najde značku "navbar-placeholder" a vloží do ní tvou lištu
document.addEventListener("DOMContentLoaded", () => {
    const placeholder = document.getElementById("navbar-placeholder");
    if (placeholder) {
        placeholder.innerHTML = navbarHTML;
    }
});
