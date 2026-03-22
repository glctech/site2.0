const toggle = document.getElementById("menu-toggle");

const nav = document.getElementById("nav");

toggle.onclick = () => {

nav.style.display =
nav.style.display === "block"
? "none"
: "block";

};