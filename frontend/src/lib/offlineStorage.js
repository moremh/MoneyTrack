const DB_NAME = "moneytrack-offline";
const DB_VERSION = 1;
const STORE_NAME = "cache";

let databasePromise = null;

const canUseIndexedDB = () =>
  typeof window !== "undefined" &&
  "indexedDB" in window;

const openDatabase = () => {
  if (!canUseIndexedDB()) {
    return Promise.resolve(null);
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise(
    (resolve, reject) => {
      const request =
        window.indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onupgradeneeded = () => {
        const database =
          request.result;

        if (
          !database.objectStoreNames.contains(
            STORE_NAME
          )
        ) {
          database.createObjectStore(
            STORE_NAME,
            {
              keyPath: "key",
            }
          );
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    }
  );

  return databasePromise;
};

const saveRecord = async (
  key,
  value
) => {
  try {
    const database =
      await openDatabase();

    if (!database) {
      return false;
    }

    return await new Promise(
      (resolve) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readwrite"
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        store.put({
          key,
          value,
          cachedAt:
            new Date().toISOString(),
        });

        transaction.oncomplete =
          () => {
            resolve(true);
          };

        transaction.onerror = () => {
          console.warn(
            "No se pudo guardar información offline:",
            transaction.error
          );

          resolve(false);
        };

        transaction.onabort = () => {
          resolve(false);
        };
      }
    );
  } catch (error) {
    console.warn(
      "IndexedDB no está disponible:",
      error
    );

    return false;
  }
};

const getRecord = async (key) => {
  try {
    const database =
      await openDatabase();

    if (!database) {
      return null;
    }

    return await new Promise(
      (resolve) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readonly"
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        const request =
          store.get(key);

        request.onsuccess = () => {
          resolve(
            request.result || null
          );
        };

        request.onerror = () => {
          console.warn(
            "No se pudo leer información offline:",
            request.error
          );

          resolve(null);
        };
      }
    );
  } catch (error) {
    console.warn(
      "No se pudo acceder a IndexedDB:",
      error
    );

    return null;
  }
};

const updateRecord = async (
  key,
  updater
) => {
  try {
    const database =
      await openDatabase();

    if (!database) {
      return false;
    }

    return await new Promise(
      (resolve) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readwrite"
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        const request =
          store.get(key);

        let didWrite = false;

        request.onsuccess = () => {
          try {
            const currentValue =
              request.result?.value ??
              null;

            const nextValue =
              updater(currentValue);

            if (
              typeof nextValue ===
              "undefined"
            ) {
              transaction.abort();
              return;
            }

            store.put({
              key,
              value: nextValue,
              cachedAt:
                new Date().toISOString(),
            });

            didWrite = true;
          } catch (error) {
            console.warn(
              "No se pudo actualizar información offline:",
              error
            );

            transaction.abort();
          }
        };

        request.onerror = () => {
          console.warn(
            "No se pudo leer el registro para actualizarlo:",
            request.error
          );

          transaction.abort();
        };

        transaction.oncomplete =
          () => {
            resolve(didWrite);
          };

        transaction.onerror = () => {
          console.warn(
            "No se pudo actualizar IndexedDB:",
            transaction.error
          );

          resolve(false);
        };

        transaction.onabort = () => {
          resolve(false);
        };
      }
    );
  } catch (error) {
    console.warn(
      "No se pudo actualizar IndexedDB:",
      error
    );

    return false;
  }
};

const deleteRecord = async (
  key
) => {
  try {
    const database =
      await openDatabase();

    if (!database) {
      return false;
    }

    return await new Promise(
      (resolve) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readwrite"
          );

        transaction
          .objectStore(STORE_NAME)
          .delete(key);

        transaction.oncomplete =
          () => {
            resolve(true);
          };

        transaction.onerror = () => {
          console.warn(
            "No se pudo eliminar información offline:",
            transaction.error
          );

          resolve(false);
        };

        transaction.onabort = () => {
          resolve(false);
        };
      }
    );
  } catch (error) {
    console.warn(
      "No se pudo limpiar IndexedDB:",
      error
    );

    return false;
  }
};

const getProfileKey = (
  userId
) => `profile:${userId}`;

const getFinanceKey = (
  userId
) => `finance:${userId}`;

const getSyncQueueKey = (
  userId
) => `sync-queue:${userId}`;

export const saveCachedProfile =
  async (user) => {
    if (!user?.id) {
      return false;
    }

    return saveRecord(
      getProfileKey(user.id),
      user
    );
  };

export const getCachedProfile =
  async (userId) => {
    if (!userId) {
      return null;
    }

    const record =
      await getRecord(
        getProfileKey(userId)
      );

    return record?.value || null;
  };

export const saveFinanceSnapshot =
  async (
    userId,
    snapshot
  ) => {
    if (!userId || !snapshot) {
      return false;
    }

    return saveRecord(
      getFinanceKey(userId),
      snapshot
    );
  };

export const getFinanceSnapshot =
  async (userId) => {
    if (!userId) {
      return null;
    }

    const record =
      await getRecord(
        getFinanceKey(userId)
      );

    return record?.value || null;
  };

/*
 * Cola persistente de sincronización.
 *
 * En esta primera etapa guardaremos aquí
 * solamente ingresos y gastos creados
 * mientras no hay conexión.
 *
 * Cada operación debe tener un id único.
 * Para las transacciones usaremos el mismo
 * UUID como id y clientMutationId.
 */

export const getPendingSyncOperations =
  async (userId) => {
    if (!userId) {
      return [];
    }

    const record =
      await getRecord(
        getSyncQueueKey(userId)
      );

    return Array.isArray(
      record?.value
    )
      ? record.value
      : [];
  };

export const addPendingSyncOperation =
  async (
    userId,
    operation
  ) => {
    if (
      !userId ||
      !operation?.id
    ) {
      return false;
    }

    return updateRecord(
      getSyncQueueKey(userId),
      (currentValue) => {
        const currentQueue =
          Array.isArray(
            currentValue
          )
            ? currentValue
            : [];

        const alreadyExists =
          currentQueue.some(
            (item) =>
              item?.id ===
              operation.id
          );

        if (alreadyExists) {
          return currentQueue;
        }

        return [
          ...currentQueue,
          {
            ...operation,
            queuedAt:
              operation.queuedAt ||
              new Date().toISOString(),
          },
        ];
      }
    );
  };

export const removePendingSyncOperation =
  async (
    userId,
    operationId
  ) => {
    if (
      !userId ||
      !operationId
    ) {
      return false;
    }

    return updateRecord(
      getSyncQueueKey(userId),
      (currentValue) => {
        const currentQueue =
          Array.isArray(
            currentValue
          )
            ? currentValue
            : [];

        return currentQueue.filter(
          (item) =>
            item?.id !==
            operationId
        );
      }
    );
  };

export const replacePendingSyncOperations =
  async (
    userId,
    operations
  ) => {
    if (
      !userId ||
      !Array.isArray(operations)
    ) {
      return false;
    }

    return saveRecord(
      getSyncQueueKey(userId),
      operations
    );
  };

export const clearPendingSyncOperations =
  async (userId) => {
    if (!userId) {
      return false;
    }

    return deleteRecord(
      getSyncQueueKey(userId)
    );
  };

export const clearUserOfflineData =
  async (userId) => {
    if (!userId) {
      return;
    }

    /*
     * No borramos la cola de sincronización
     * automáticamente.
     *
     * Puede contener movimientos creados
     * sin conexión que todavía no llegaron
     * a Supabase. Si la elimináramos durante
     * un cierre de sesión, podríamos perder
     * información pendiente.
     */

    await Promise.all([
      deleteRecord(
        getProfileKey(userId)
      ),
      deleteRecord(
        getFinanceKey(userId)
      ),
    ]);
  };