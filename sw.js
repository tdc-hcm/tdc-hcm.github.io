// Service Worker cho PWA "Báo cáo TDC" — CHỈ cache khung giao diện TĨNH (app.html/manifest/icon),
// KHÔNG BAO GIỜ cache lệnh gọi API thật (mọi request tới script.google.com luôn đi thẳng qua
// mạng, bỏ qua cache hoàn toàn) — tránh rủi ro hiện dữ liệu báo cáo CŨ mà tưởng là mới. Cache
// app-shell giúp mở lại gần như tức thời (đúng yêu cầu "trải nghiệm như app thông thường") + vẫn
// thấy được giao diện (dù chưa tải được dữ liệu) khi mất mạng tạm thời.
var CACHE_NAME = 'bc-tdc-shell-v5'; // v4 -> v5 — cache Tab Dự án/Bộ phận có điều kiện (chỉ hiện
                                     // nếu <6h tuổi), thêm cơ chế làm mới ngầm mọi tab tối đa
                                     // 1 lần/6 phút mỗi khi quay lại app.
var SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL_FILES); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = event.request.url;
  // Không đụng tới request gọi backend Apps Script — luôn đi thẳng qua mạng thật, không qua Service
  // Worker/cache, để dữ liệu báo cáo luôn mới nhất.
  if (url.indexOf('script.google.com') !== -1) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request).then(function (res) {
        if (res && res.status === 200) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, resClone); });
        }
        return res;
      }).catch(function () { return cached; });
      // Có cache -> trả NGAY (nhanh), vẫn âm thầm gọi mạng để cập nhật cache cho lần sau
      // (stale-while-revalidate). Chưa có cache (lần đầu mở) -> chờ mạng.
      return cached || networkFetch;
    })
  );
});
