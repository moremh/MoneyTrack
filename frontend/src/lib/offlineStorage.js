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
 * ============================================================
 * COLA PERSISTENTE DE SINCRONIZACIÓN
 * ============================================================
 *
 * La cola puede contener:
 *
 * transaction / create
 * transaction / update
 * transaction / delete
 *
 * Para una misma transacción intentamos mantener
 * solamente la operación mínima necesaria.
 *
 * Ejemplos:
 *
 * CREATE + UPDATE
 * → CREATE con los últimos datos
 *
 * CREATE + DELETE
 * → no queda ninguna operación
 *
 * UPDATE + UPDATE
 * → un solo UPDATE
 *
 * UPDATE + DELETE
 * → un solo DELETE
 */


const getTransactionTargetId =
  (operation) => {
    if (
      !operation ||
      operation.entity !==
        "transaction"
    ) {
      return null;
    }

    /*
     * Una transacción creada offline todavía
     * no tiene id de Supabase.
     *
     * Su clientMutationId funciona como
     * identificador local.
     */
    if (
      operation.action ===
      "create"
    ) {
      return (
        operation.clientMutationId ||
        operation.transactionId ||
        operation.id ||
        null
      );
    }

    /*
     * UPDATE y DELETE trabajan sobre una
     * transacción que ya existe.
     */
    return (
      operation.transactionId ||
      operation.payload
        ?.transactionId ||
      null
    );
  };


const isSameTransactionOperation =
  (
    queuedOperation,
    incomingOperation
  ) => {
    if (
      queuedOperation?.entity !==
        "transaction" ||
      incomingOperation?.entity !==
        "transaction"
    ) {
      return false;
    }

    const queuedTargetId =
      getTransactionTargetId(
        queuedOperation
      );

    const incomingTargetId =
      getTransactionTargetId(
        incomingOperation
      );

    return (
      Boolean(
        queuedTargetId
      ) &&
      queuedTargetId ===
        incomingTargetId
    );
  };


const normalizeSyncOperation =
  (operation) => {
    const now =
      new Date().toISOString();

    return {
      ...operation,

      queuedAt:
        operation.queuedAt ||
        now,

      lastUpdatedAt:
        now,
    };
  };


const mergeTransactionOperations =
  (
    existingOperation,
    incomingOperation
  ) => {
    const incoming =
      normalizeSyncOperation(
        incomingOperation
      );

    if (!existingOperation) {
      return incoming;
    }

    const existing =
      existingOperation;


    /*
     * ========================================================
     * CREATE + UPDATE
     * ========================================================
     *
     * La transacción todavía no existe en Supabase.
     * No necesitamos enviar CREATE y después UPDATE.
     *
     * Actualizamos directamente el CREATE pendiente.
     */

    if (
      existing.action ===
        "create" &&
      incoming.action ===
        "update"
    ) {
      return {
        ...existing,

        type:
          incoming.type ||
          existing.type,

        payload: {
          ...existing.payload,
          ...incoming.payload,
        },

        lastUpdatedAt:
          new Date().toISOString(),
      };
    }


    /*
     * ========================================================
     * CREATE + DELETE
     * ========================================================
     *
     * Si fue creada offline y eliminada antes de
     * sincronizarse, no debe llegar nunca a Supabase.
     */

    if (
      existing.action ===
        "create" &&
      incoming.action ===
        "delete"
    ) {
      return null;
    }


    /*
     * ========================================================
     * CREATE + CREATE
     * ========================================================
     *
     * No debería ocurrir normalmente, pero lo hacemos
     * idempotente por seguridad.
     */

    if (
      existing.action ===
        "create" &&
      incoming.action ===
        "create"
    ) {
      return {
        ...existing,

        type:
          incoming.type ||
          existing.type,

        payload: {
          ...existing.payload,
          ...incoming.payload,
        },

        lastUpdatedAt:
          new Date().toISOString(),
      };
    }


    /*
     * ========================================================
     * UPDATE + UPDATE
     * ========================================================
     *
     * Solamente necesitamos sincronizar la última versión.
     *
     * Conservamos expectedUpdatedAt del primer UPDATE
     * porque representa la versión original del servidor.
     *
     * Eso permite detectar correctamente conflictos si
     * otro dispositivo modificó la transacción.
     */

    if (
      existing.action ===
        "update" &&
      incoming.action ===
        "update"
    ) {
      return {
        ...existing,

        type:
          incoming.type ||
          existing.type,

        payload: {
          ...existing.payload,
          ...incoming.payload,
        },

        expectedUpdatedAt:
          existing
            .expectedUpdatedAt ||
          incoming
            .expectedUpdatedAt ||
          null,

        lastUpdatedAt:
          new Date().toISOString(),
      };
    }


    /*
     * ========================================================
     * UPDATE + DELETE
     * ========================================================
     *
     * Ya no tiene sentido enviar el UPDATE.
     * Solamente queremos eliminar la transacción.
     *
     * Conservamos expectedUpdatedAt original para detectar
     * modificaciones realizadas desde otro dispositivo.
     */

    if (
      existing.action ===
        "update" &&
      incoming.action ===
        "delete"
    ) {
      return {
        ...incoming,

        expectedUpdatedAt:
          existing
            .expectedUpdatedAt ||
          incoming
            .expectedUpdatedAt ||
          null,

        queuedAt:
          existing.queuedAt ||
          incoming.queuedAt,

        lastUpdatedAt:
          new Date().toISOString(),
      };
    }


    /*
     * ========================================================
     * DELETE + DELETE
     * ========================================================
     *
     * El DELETE es idempotente.
     * Mantenemos solamente uno.
     */

    if (
      existing.action ===
        "delete" &&
      incoming.action ===
        "delete"
    ) {
      return {
        ...existing,

        lastUpdatedAt:
          new Date().toISOString(),
      };
    }


    /*
     * ========================================================
     * DELETE + UPDATE
     * ========================================================
     *
     * Una transacción eliminada localmente no debería volver
     * a editarse desde la interfaz.
     *
     * Si llegara a ocurrir por algún estado extraño,
     * conservamos DELETE.
     */

    if (
      existing.action ===
        "delete" &&
      incoming.action ===
        "update"
    ) {
      return existing;
    }


    /*
     * Cualquier combinación inesperada usa
     * la operación más reciente.
     */

    return incoming;
  };


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


/*
 * ============================================================
 * GUARDAR / COMBINAR OPERACIÓN DE TRANSACCIÓN
 * ============================================================
 */

export const queueTransactionSyncOperation =
  async (
    userId,
    operation
  ) => {
    if (
      !userId ||
      !operation?.id ||
      operation?.entity !==
        "transaction" ||
      ![
        "create",
        "update",
        "delete",
      ].includes(
        operation?.action
      )
    ) {
      return false;
    }

    const targetId =
      getTransactionTargetId(
        operation
      );

    if (!targetId) {
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

        /*
         * Buscamos si ya existe alguna
         * operación pendiente para esa
         * misma transacción.
         */

        const firstMatchIndex =
          currentQueue.findIndex(
            (queuedOperation) =>
              isSameTransactionOperation(
                queuedOperation,
                operation
              )
          );

        /*
         * Si no hay ninguna operación
         * previa, simplemente agregamos.
         */

        if (
          firstMatchIndex === -1
        ) {
          return [
            ...currentQueue,
            normalizeSyncOperation(
              operation
            ),
          ];
        }


        const existingOperation =
          currentQueue[
            firstMatchIndex
          ];

        const mergedOperation =
          mergeTransactionOperations(
            existingOperation,
            operation
          );


        /*
         * Puede haber más de una operación vieja
         * para la misma transacción por versiones
         * anteriores de MoneyTrack.
         *
         * Las limpiamos y dejamos una sola.
         */

        const nextQueue = [];

        for (
          let index = 0;
          index <
          currentQueue.length;
          index += 1
        ) {
          const queuedOperation =
            currentQueue[index];

          const sameTransaction =
            isSameTransactionOperation(
              queuedOperation,
              operation
            );

          if (!sameTransaction) {
            nextQueue.push(
              queuedOperation
            );

            continue;
          }

          /*
           * Solamente en la primera coincidencia
           * colocamos la operación combinada.
           */

          if (
            index ===
              firstMatchIndex &&
            mergedOperation
          ) {
            nextQueue.push(
              mergedOperation
            );
          }
        }

        /*
         * Si mergedOperation es null significa:
         *
         * CREATE + DELETE
         *
         * En ese caso no agregamos nada.
         */

        return nextQueue;
      }
    );
  };


/*
 * Compatibilidad con el código que ya tenemos.
 *
 * addMovement actualmente usa
 * addPendingSyncOperation().
 *
 * Para transacciones lo enviamos al nuevo
 * sistema inteligente de combinación.
 */

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

    if (
      operation.entity ===
      "transaction"
    ) {
      return (
        queueTransactionSyncOperation(
          userId,
          operation
        )
      );
    }

    /*
     * Dejamos soporte genérico por si
     * más adelante la cola maneja otras
     * entidades de MoneyTrack.
     */

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
          normalizeSyncOperation(
            operation
          ),
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


/*
 * Elimina todas las operaciones relacionadas
 * con una transacción concreta.
 *
 * Nos va a servir especialmente cuando una
 * transacción creada offline se elimina antes
 * de llegar al servidor.
 */

export const removePendingTransactionOperations =
  async (
    userId,
    transactionId
  ) => {
    if (
      !userId ||
      !transactionId
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
          (operation) => {
            if (
              operation?.entity !==
              "transaction"
            ) {
              return true;
            }

            const targetId =
              getTransactionTargetId(
                operation
              );

            return (
              targetId !==
              transactionId
            );
          }
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
      !Array.isArray(
        operations
      )
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