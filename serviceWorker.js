self.addEventListener("fetch", function (event) {
    console.log(`start server worker`)
});
self.addEventListener("install", event => {
    console.log("Service worker installed");
 });
 self.addEventListener("activate", event => {
    console.log("Service worker activated");
 });