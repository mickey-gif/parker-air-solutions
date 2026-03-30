// Version 2.4.1
(function () {
  'use strict';
  const WORKER_URL = 'https://store-loactor.kilr.workers.dev/';
  let map, markers = [], markerClusterer;
  let userLat = null, userLng = null;
  let defaultLat, defaultLng, defaultZoom;
  const loaderEl = document.querySelector('[kilr-store-locator="loader"]');
  const MAX_SEARCH_RADIUS_METERS = 50000;

  function getCspNonce() {
    const metaNonce = document.querySelector('meta[name="csp-nonce"]');
    if (metaNonce && metaNonce.content) return metaNonce.content;
    const scriptWithNonce = document.querySelector('script[nonce]');
    return scriptWithNonce ? scriptWithNonce.getAttribute('nonce') : '';
  }

  (async function fetchKeyAndLoadMaps() {
    try {
      const abortController = new AbortController();
      const abortTimeoutId = setTimeout(() => abortController.abort(), 8000);
      
      // Resolve worker URL from multiple sources: data attribute, meta tag, global, then default
      let configuredWorkerUrl = WORKER_URL;
      try {
        const listEl = document.querySelector('[kilr-store-locator="list"]');
        const dataUrl = listEl && listEl.getAttribute('data-worker-url');
        const metaEl = document.querySelector('meta[name="kilr-worker-url"]');
        const metaUrl = metaEl && metaEl.getAttribute('content');
        const globalUrl = (window && (window.KILR_STORE_LOCATOR_WORKER_URL || window.KILR_WORKER_URL));
        configuredWorkerUrl = dataUrl || metaUrl || globalUrl || WORKER_URL;
      } catch (_) { /* no-op */ }
      
      let requestUrl;
      try {
        requestUrl = new URL(configuredWorkerUrl);
      } catch (_) {
        
        return;
      }
      
      // Add domain information for KV lookup while keeping it secure
      try {
        const originHint = (window.location && window.location.origin) ? window.location.origin : '';
        const hostHint = (window.location && window.location.host) ? window.location.host : '';
        const domainHint = (window.location && window.location.hostname) ? window.location.hostname : '';
        
        // Extract domain (remove protocol but keep subdomains)
        let cleanDomain = domainHint;
        if (cleanDomain) {
          // Remove www. prefix if present, but keep other subdomains
          cleanDomain = cleanDomain.replace(/^www\./, '');
        }
        
        if (cleanDomain) requestUrl.searchParams.set('domain', cleanDomain);
        requestUrl.searchParams.set('t', String(Date.now()));
        
        
      } catch (_) { /* no-op */ }

      // Try to get API key from data attributes first as fallback
      const listEl = document.querySelector('[kilr-store-locator="list"]');
      let fallbackApiKey = listEl && listEl.getAttribute('data-api-key');
      
      // Also check meta tags and global variables for fallback
      if (!fallbackApiKey) {
        const metaKey = document.querySelector('meta[name="kilr-google-maps-api-key"]');
        fallbackApiKey = metaKey && metaKey.content;
      }
      
      if (!fallbackApiKey && window.KILR_GOOGLE_MAPS_API_KEY) {
        fallbackApiKey = window.KILR_GOOGLE_MAPS_API_KEY;
      }
      
      if (fallbackApiKey && fallbackApiKey.length >= 20) {
        
        loadGoogleMaps(fallbackApiKey);
        return;
      }

      const response = await fetch(requestUrl.toString(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal: abortController.signal
      });
      clearTimeout(abortTimeoutId);

      if (!response.ok) {
        
        
        // Try to get error details from the response
        try {
          const errorData = await response.text();
          
          
          // Try to parse as JSON for more details
          try {
            const errorJson = JSON.parse(errorData);
            
          } catch (parseError) {
            
          }
        } catch (textError) {
          
        }
        
        // Try fallback API key if available
        if (fallbackApiKey && fallbackApiKey.length >= 20) {
          
          loadGoogleMaps(fallbackApiKey);
          return;
        }
        
        // If no fallback, show error and return
        
        return;
      }

      let data;
      try {
        data = await response.json();
        // Debug: Log what we received
        
      } catch (_) {
        
        return;
      }

      if (!data || typeof data.apiKey !== 'string' || data.apiKey.length < 20) {
        
        return;
      }

      loadGoogleMaps(data.apiKey);
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        
      } else {
        
      }
      
      // Try fallback API key if available
      const listEl = document.querySelector('[kilr-store-locator="list"]');
      const fallbackApiKey = listEl && listEl.getAttribute('data-api-key');
      if (fallbackApiKey && fallbackApiKey.length >= 20) {
        
        loadGoogleMaps(fallbackApiKey);
        return;
      }
    }
  })();

  function loadGoogleMaps(apiKey) {
    const callbackName = `__gmaps_cb_${Math.random().toString(36).slice(2)}`;
    const scriptEl = document.createElement('script');

          const gmapsUrl = new URL('https://maps.googleapis.com/maps/api/js');
      gmapsUrl.searchParams.set('key', apiKey);
      gmapsUrl.searchParams.set('v', 'quarterly');
      gmapsUrl.searchParams.set('libraries', 'places');
      gmapsUrl.searchParams.set('callback', callbackName);
      gmapsUrl.searchParams.set('loading', 'async');

    scriptEl.src = gmapsUrl.toString();
    scriptEl.async = true;
    scriptEl.defer = true;
    scriptEl.crossOrigin = 'anonymous';
    scriptEl.referrerPolicy = 'no-referrer';
    const nonce = getCspNonce();
    if (nonce) scriptEl.setAttribute('nonce', nonce);

    window[callbackName] = function () {
      if (!(window.google && google.maps)) {
        
        return;
      }
      
      
      
      try {
        setTimeout(initMap, 500);
      } catch (_) { /* no-op */ }
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    };

    document.head.appendChild(scriptEl);
  }


  function clampZoom(zoom) {
    if (Number.isNaN(zoom)) return 4;
    if (zoom < 1) return 1;
    if (zoom > 21) return 21;
    return zoom;
  }

  function initMap() {
    
    
    if (!(window.google && google.maps)) {
      
      hideLoader();
      return;
    }
    
    const listEl = document.querySelector('[kilr-store-locator="list"]');
    const mapEl = document.querySelector('[kilr-store-locator="map"]');
    
    
    
    if (!listEl || !mapEl) {
      
      return;
    }

    mapEl.style.width = '100%';
    mapEl.style.height = '100%';

    defaultLat = parseFloat(listEl.getAttribute('data-default-lat')) || -27.46651424507259;
    defaultLng = parseFloat(listEl.getAttribute('data-default-long')) || 153.0109915457231;
    defaultZoom = clampZoom(parseInt(listEl.getAttribute('data-default-zoom'), 10) || 4);
    const activeZoom = clampZoom(parseInt(listEl.getAttribute('data-active-zoom'), 10) || 15);
    const mapId = listEl.getAttribute('data-map-id') || '';

    map = new google.maps.Map(mapEl, {
      zoom: clampZoom(defaultZoom),
      center: { lat: defaultLat, lng: defaultLng },
      mapId: mapId || undefined,
    });

    markers = addStoreMarkers(map, activeZoom);
    
    
    
    if (markers.length > 0) {
      // Load marker clusterer from CDN
      
      loadMarkerClustererFromCDN();
      
      // Set a timeout to fall back to built-in clustering if CDN fails
      setTimeout(() => {
        if (!markerClusterer) {
          
          tryBuiltInClustering();
        }
      }, 3000); // Wait 3 seconds for CDN to load

      // Fit bounds to show all markers
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.getPosition()));
      map.fitBounds(bounds);
    }

    setupResetButtons();
    setupSearch();
    setupUserLocation();

    google.maps.event.addListener(map, 'bounds_changed', () => {
      try { filterItemsByMapBounds(map); } catch (_) { /* no-op */ }
    });
    map.addListener('zoom_changed', () => {
      try { filterItemsByMapBounds(map); } catch (_) { /* no-op */ }
    });
    map.addListener('dragend', () => {
      try { filterItemsByMapBounds(map); } catch (_) { /* no-op */ }
    });

    hideLoader();
  }

  // Distance calculations are now handled by the search functionality
  function computeDistanceMeters(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function addStoreMarkers(gMap, activeZoom) {
    const elements = document.querySelectorAll('[kilr-store-locator="item"]');
    
    
    const markerArr = [];
    elements.forEach((element, index) => {
      const lat = parseFloat(element.getAttribute('data-latitude'));
      const lng = parseFloat(element.getAttribute('data-longitude'));
      
      
      
      if (isNaN(lat) || isNaN(lng)) {
        // Invalid coordinates; skip marker creation
        
        return;
      }

      try {
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: gMap,
        });
        // Link marker to its DOM item to avoid index-based mismatches
        marker.__itemEl = element;
        markerArr.push(marker);
        
        
        
        // Add click listener to marker
        marker.addListener('click', () => {
          setActiveItem(element);
          zoomToLocation(lat, lng, activeZoom);
        });
        
        // Add click listener to the store item element
        element.addEventListener('click', () => {
          setActiveItem(element);
          zoomToLocation(lat, lng, activeZoom);
        });
        
      } catch (error) {
        
        // Swallow marker creation errors to avoid leaking environment details
      }
    });

    
    return markerArr;
  }

  function setActiveItem(activeItemEl) {
    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
      const titleEl = item.querySelector('[kilr-store-locator="title"]');
      const isActive = item === activeItemEl;
      item.classList.toggle('is-active', isActive);
      if (titleEl) titleEl.classList.toggle('is-active', isActive);
    });
  }

  function zoomToLocation(lat, lng, zoomLevel) {
    if (!map) return;
    
    const position = { lat, lng };
    map.setCenter(position);
    map.setZoom(zoomLevel || 15);
  }

  function setupResetButtons() {
    const resetButtons = document.querySelectorAll('[kilr-store-locator="reset"]');
    resetButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        resetMapMarkersAndItems();
      });
    });
  }

  function resetMapMarkersAndItems() {
    map.setCenter({ lat: defaultLat, lng: defaultLng });
    map.setZoom(defaultZoom);
    if (markerClusterer) {
      try {
        markerClusterer.clearMarkers();
        markerClusterer.addMarkers(markers);
      } catch (_) { /* no-op */ }
    } else {
      // If no clusterer, just ensure all markers are visible
      markers.forEach(marker => {
        try { marker.setMap(map); } catch (_) { /* no-op */ }
      });
    }

    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
      item.style.display = '';
      item.classList.remove('is-active');
    });
  }

  function setupSearch() {
    const searchInput = document.querySelector('[kilr-store-locator="search"]');
    if (!searchInput) return;

    const geocoder = new google.maps.Geocoder();
    let searchTimeout;
    let lastSearchToken = 0;

    searchInput.addEventListener('input', () => {
        const address = searchInput.value.trim();
        if (!address || address.length < 3) {
            resetMapMarkersAndItems();
            clearDistances();
            return;
        }

        // Clear existing timeout
        if (searchTimeout) clearTimeout(searchTimeout);

        // Add debounce to prevent too many geocoding requests
        const token = ++lastSearchToken;
        searchTimeout = setTimeout(() => {
            geocoder.geocode({ address }, (results, status) => {
                if (token !== lastSearchToken) return; // ignore stale results
                if (status === 'OK' && results.length) {
                    const searchLocation = results[0].geometry.location;
                    filterMarkersAndItems(searchLocation);
                    updateDistancesFromLocation(searchLocation);
                } else {
                    resetMapMarkersAndItems();
                    clearDistances();
                }
            });
        }, 500);
    });
}

function setupUserLocation() {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        
        hideDistanceFields();
        return;
    }

    // Show distance fields initially
    showDistanceFields();

    // Ask for user location
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Success - got user location
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
            
            
            
            // Update distances for all stores
            updateDistancesFromUserLocation();
        },
        (error) => {
            // Error - user denied or location unavailable
            
            hideDistanceFields();
            sortStores('random');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        }
    );
}

function updateDistancesFromUserLocation() {
    if (userLat === null || userLng === null) return;
    
    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
        const distanceEl = item.querySelector('[kilr-store-locator="distance"]');
        if (!distanceEl) return;

        const lat = parseFloat(item.getAttribute('data-latitude'));
        const lng = parseFloat(item.getAttribute('data-longitude'));
        if (isNaN(lat) || isNaN(lng)) return;

        const distanceMeters = computeDistanceMeters(userLat, userLng, lat, lng);
        item.dataset.distance = distanceMeters;
        distanceEl.textContent = distanceMeters < 1000
            ? `${distanceMeters.toFixed(0)} m away`
            : `${(distanceMeters / 1000).toFixed(1)} km away`;
    });
    sortStores('distance');
}

function showDistanceFields() {
    const distanceElements = document.querySelectorAll('[kilr-store-locator="distance"]');
    distanceElements.forEach(el => {
        el.classList.remove('is-hidden');
        el.textContent = 'Calculating distance...';
    });
}

function hideDistanceFields() {
    const distanceElements = document.querySelectorAll('[kilr-store-locator="distance"]');
    distanceElements.forEach(el => {
        el.classList.add('is-hidden');
        el.textContent = '';
    });
  }

  function sortStores(sortBy = 'distance') {
    const listContainer = document.querySelector('[kilr-store-locator="list"]');
    if (!listContainer) return;

    const items = Array.from(listContainer.querySelectorAll('[kilr-store-locator="item"]'));
    
    // Separate visible and hidden items to respect search filters
    const visibleItems = items.filter(item => item.style.display !== 'none');
    const hiddenItems = items.filter(item => item.style.display === 'none');

    if (sortBy === 'distance') {
        visibleItems.sort((a, b) => {
            const distA = parseFloat(a.dataset.distance) || Infinity;
            const distB = parseFloat(b.dataset.distance) || Infinity;
            return distA - distB;
        });
    } else if (sortBy === 'random') {
        visibleItems.sort(() => Math.random() - 0.5);
    }

    // Re-append sorted visible items first, then hidden items
    visibleItems.forEach(item => listContainer.appendChild(item));
    hiddenItems.forEach(item => listContainer.appendChild(item));
  }

  function loadMarkerClustererFromCDN() {
    
    const cdnUrls = [
      'https://unpkg.com/@googlemaps/markerclusterer@2.0.15/dist/index.min.js',
      'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.0.15/dist/index.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/markerclusterer/2.0.15/index.min.js',
      'https://unpkg.com/@googlemaps/markerclustererplus@5.1.5/dist/index.min.js',
      'https://cdn.jsdelivr.net/npm/@googlemaps/markerclustererplus@5.1.5/dist/index.min.js'
    ];
    
    
    let currentCdnIndex = 0;
    
    function tryNextCDN() {
      if (currentCdnIndex >= cdnUrls.length) {
        
        markerClusterer = null;
        return;
      }
      
      const script = document.createElement('script');
      script.src = cdnUrls[currentCdnIndex];
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      
      
      script.onload = () => {
        
        
        
        // Add a small delay to ensure the library is fully loaded
        setTimeout(() => {
          
          
          
          
          
          try {
            // New library (@googlemaps/markerclusterer) exposes window.markerClusterer.MarkerClusterer
            if (typeof window.markerClusterer?.MarkerClusterer === 'function') {
              
              markerClusterer = new window.markerClusterer.MarkerClusterer({
                map,
                markers,
              });
              
            } else if (typeof window.MarkerClusterer === 'function') {
              // Legacy library (markerclustererplus)
              
              markerClusterer = new window.MarkerClusterer(map, markers, {
                imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
                gridSize: 50,
                maxZoom: 15
              });
              
            } else {
              throw new Error('No marker clusterer API found');
            }
          } catch (error) {
            
            currentCdnIndex++;
            tryNextCDN();
          }
        }, 100); // 100ms delay to ensure library is fully loaded
      };
      
      script.onerror = () => {
        
        currentCdnIndex++;
        tryNextCDN();
      };
      
      document.head.appendChild(script);
    }
    
    tryNextCDN();
  }

  function tryBuiltInClustering() {
    
    try {
      markerClusterer = new google.maps.marker.AdvancedMarkerClusterer({
        map,
        markers,
        gridSize: 50,
        maxZoom: 15
      });
      
    } catch (error) {
      
      markerClusterer = null; // Ensure it's null if it fails
    }
  }

function updateDistancesFromLocation(location) {
    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
        const distanceEl = item.querySelector('[kilr-store-locator="distance"]');
        if (!distanceEl) return;

        const lat = parseFloat(item.getAttribute('data-latitude'));
        const lng = parseFloat(item.getAttribute('data-longitude'));
        if (isNaN(lat) || isNaN(lng)) return;

        const locLat = typeof location.lat === 'function' ? location.lat() : location.lat;
        const locLng = typeof location.lng === 'function' ? location.lng() : location.lng;
        if (typeof locLat !== 'number' || typeof locLng !== 'number') return;

        const distanceMeters = computeDistanceMeters(locLat, locLng, lat, lng);
        item.dataset.distance = distanceMeters;
        distanceEl.textContent = distanceMeters < 1000
            ? `${distanceMeters.toFixed(0)} m away`
            : `${(distanceMeters / 1000).toFixed(1)} km away`;
    });
    sortStores('distance');
}

function clearDistances() {
    const distanceElements = document.querySelectorAll('[kilr-store-locator="distance"]');
    distanceElements.forEach(el => el.textContent = '');
}

  function filterMarkersAndItems(location) {
    const filteredMarkers = [];
    const bounds = new google.maps.LatLngBounds();

    const locLat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const locLng = typeof location.lng === 'function' ? location.lng() : location.lng;
    if (typeof locLat !== 'number' || typeof locLng !== 'number') return;

    markers.forEach((marker) => {
      const pos = marker.getPosition();
      const mLat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
      const mLng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
      if (typeof mLat !== 'number' || typeof mLng !== 'number') return;

      const distance = computeDistanceMeters(mLat, mLng, locLat, locLng);
      if (distance < MAX_SEARCH_RADIUS_METERS) {
        filteredMarkers.push(marker);
        bounds.extend(marker.getPosition());
        if (marker.__itemEl) marker.__itemEl.style.display = '';
      } else {
        if (marker.__itemEl) marker.__itemEl.style.display = 'none';
      }
    });

    if (markerClusterer) {
      try {
        markerClusterer.clearMarkers();
        markerClusterer.addMarkers(filteredMarkers);
      } catch (_) { /* no-op */ }
    } else {
      // Fallback when clusterer isn't available: toggle marker visibility
      markers.forEach((marker) => {
        try { marker.setMap(null); } catch (_) { /* no-op */ }
      });
      filteredMarkers.forEach((marker) => {
        try { marker.setMap(map); } catch (_) { /* no-op */ }
      });
    }

    if (filteredMarkers.length > 0) {
      map.fitBounds(bounds);
    } else {
      map.setCenter(location);
      map.setZoom(defaultZoom);
    }
  }

  function filterItemsByMapBounds(gMap) {
    const bounds = gMap.getBounds();
    if (!bounds) return;

    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
      const lat = parseFloat(item.getAttribute('data-latitude'));
      const lng = parseFloat(item.getAttribute('data-longitude'));
      if (isNaN(lat) || isNaN(lng)) {
        item.style.display = 'none';
        return;
      }
      const pos = new google.maps.LatLng(lat, lng);
      const isVisible = bounds.contains(pos);
      item.style.display = isVisible ? '' : 'none';
    });
  }

  function hideLoader() {
    if (loaderEl) loaderEl.style.display = 'none';
  }
})();
