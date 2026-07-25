const RADIOGRAPH_DB_NAME = "RadiographGoldStandardDB";
const RADIOGRAPH_DB_VERSION = 1;
const RADIOGRAPH_IMAGE_STORE = "images";

function openRadiographDatabase() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported by this browser."));
      return;
    }

    const request = indexedDB.open(
      RADIOGRAPH_DB_NAME,
      RADIOGRAPH_DB_VERSION
    );

    request.onupgradeneeded = function () {
      const database = request.result;

      if (!database.objectStoreNames.contains(RADIOGRAPH_IMAGE_STORE)) {
        const store = database.createObjectStore(
          RADIOGRAPH_IMAGE_STORE,
          { keyPath: "image_id" }
        );

        store.createIndex(
          "file_name",
          "file_name",
          { unique: false }
        );
      }
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(request.error || new Error("Cannot open the image database."));
    };

    request.onblocked = function () {
      reject(
        new Error(
          "The image database is blocked by another open tab. Close other tabs of this website and try again."
        )
      );
    };
  });
}

async function requestPersistentRadiographStorage() {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    if (navigator.storage.persisted) {
      const alreadyPersistent = await navigator.storage.persisted();

      if (alreadyPersistent) {
        return true;
      }
    }

    return await navigator.storage.persist();
  } catch (error) {
    console.warn("Persistent storage request failed:", error);
    return false;
  }
}

async function getRadiographStorageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    return await navigator.storage.estimate();
  } catch (error) {
    console.warn("Storage estimate failed:", error);
    return null;
  }
}

async function saveRadiographFilesToDB(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  const database = await openRadiographDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      RADIOGRAPH_IMAGE_STORE,
      "readwrite"
    );

    const store = transaction.objectStore(RADIOGRAPH_IMAGE_STORE);

    files.forEach(function (file, index) {
      const imageId = file.name.replace(/\.[^/.]+$/, "");

      store.put({
        image_id: imageId,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size_bytes: file.size || 0,
        last_modified: file.lastModified || Date.now(),
        upload_order: index + 1,
        blob: file
      });
    });

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error =
        transaction.error ||
        new Error("The radiograph images could not be saved.");

      database.close();
      reject(error);
    };

    transaction.onabort = function () {
      const error =
        transaction.error ||
        new Error("Saving radiograph images was cancelled.");

      database.close();
      reject(error);
    };
  });
}

async function loadRadiographFilesFromDB() {
  const database = await openRadiographDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      RADIOGRAPH_IMAGE_STORE,
      "readonly"
    );

    const store = transaction.objectStore(RADIOGRAPH_IMAGE_STORE);
    const request = store.getAll();

    request.onsuccess = function () {
      const records = request.result || [];

      records.sort(function (a, b) {
        return a.file_name.localeCompare(
          b.file_name,
          undefined,
          { numeric: true }
        );
      });

      const files = records.map(function (record) {
        return new File(
          [record.blob],
          record.file_name,
          {
            type: record.file_type || record.blob.type || "",
            lastModified: record.last_modified || Date.now()
          }
        );
      });

      resolve(files);
    };

    request.onerror = function () {
      reject(
        request.error ||
        new Error("Saved radiograph images could not be loaded.")
      );
    };

    transaction.oncomplete = function () {
      database.close();
    };
  });
}

async function deleteAllRadiographFilesFromDB() {
  const database = await openRadiographDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      RADIOGRAPH_IMAGE_STORE,
      "readwrite"
    );

    const store = transaction.objectStore(RADIOGRAPH_IMAGE_STORE);
    store.clear();

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      const error =
        transaction.error ||
        new Error("Saved radiograph images could not be deleted.");

      database.close();
      reject(error);
    };
  });
}
