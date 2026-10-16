// 檔案位置：src/services/assetPreloader.js
// Full Deck Image Preloader & In-Memory Cache (Prevents GC eviction & slow school network fallback cards)

const COLORS = ['red', 'yellow', 'green', 'blue'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

// Keep strong references in memory so the browser never evicts preloaded card textures
const memoryImageCache = new Map();

export function getDeckAssetUrls(theme = 'classic') {
  const folder = theme === 'rabbids' ? 'cards_rabbids' : 'cards_modern';
  const keys = new Set(['card_back', 'wild', 'wild_draw4']);

  for (const color of COLORS) {
    for (const val of VALUES) {
      keys.add(`${color}_${val}`);
    }
    keys.add(`wild_${color}`);
    keys.add(`wild_draw4_${color}`);
  }

  if (theme === 'rabbids') {
    keys.add('rabbids_hurry_up');
    keys.add('rabbids_explosive');
    keys.add('rabbids_comin_through');
    keys.add('rabbids_wild_shield');
    for (const color of COLORS) {
      keys.add(`rabbids_wild_shield_${color}`);
    }
  }

  const resultUrls = Array.from(keys).map((k) => `/${folder}/${k}.png`);
  if (theme === 'rabbids') {
    resultUrls.push('/cards_rabbids/effects/hurry_up/toothless-dancing-toothless.gif');
  }
  return resultUrls;
}

export function isDeckThemeLoaded(theme = 'classic') {
  const urls = getDeckAssetUrls(theme);
  return urls.every((url) => memoryImageCache.has(url));
}

export function preloadDeckAssets(theme = 'classic', onProgress = null) {
  const urls = getDeckAssetUrls(theme);
  const total = urls.length;
  let loaded = 0;

  const report = () => {
    loaded++;
    if (onProgress) {
      onProgress({
        loaded,
        total,
        percent: Math.min(100, Math.round((loaded / total) * 100))
      });
    }
  };

  const promises = urls.map((url) => {
    if (memoryImageCache.has(url)) {
      report();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      const finish = () => {
        memoryImageCache.set(url, img);
        report();
        resolve();
      };

      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(finish).catch(finish);
        } else {
          finish();
        }
      };

      img.onerror = () => {
        // Retry once with cache-busting query if school network dropped a packet
        const retryImg = new Image();
        retryImg.onload = () => {
          memoryImageCache.set(url, retryImg);
          report();
          resolve();
        };
        retryImg.onerror = () => {
          report();
          resolve();
        };
        retryImg.src = url;
      };

      img.src = url;
    });
  });

  return Promise.all(promises);
}
