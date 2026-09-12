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
 * Entidades soportadas:
 * - transaction
 * - goal_movement
 *
 * Acciones:
 * - create
 * - update
 * - delete
 */

const SUPPORTED_SYNC_ACTIONS = [
  "create",
  "update",
  "delete",
];

const normalizeSyncOperation = (
  operation
) => {
  const now =
    new Date().toISOString();

  return {
    ...operation,
    queuedAt:
      operation?.queuedAt || now,
    lastUpdatedAt: now,
  };
};

const getTransactionTargetId = (
  operation
) => {
  if (
    operation?.entity !==
    "transaction"
  ) {
    return null;
  }

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

  return (
    operation.transactionId ||
    operation.payload
      ?.transactionId ||
    null
  );
};

const getGoalMovementTargetId = (
  operation
) => {
  if (
    operation?.entity !==
    "goal_movement"
  ) {
    return null;
  }

  if (
    operation.action ===
    "create"
  ) {
    return (
      operation.clientMutationId ||
      operation.goalMovementId ||
      operation.movementId ||
      operation.id ||
      null
    );
  }

  return (
    operation.goalMovementId ||
    operation.movementId ||
    operation.payload
      ?.goalMovementId ||
    operation.payload
      ?.movementId ||
    null
  );
};

const getSyncOperationTargetId = (
  operation
) => {
  if (
    operation?.entity ===
    "transaction"
  ) {
    return getTransactionTargetId(
      operation
    );
  }

  if (
    operation?.entity ===
    "goal_movement"
  ) {
    return getGoalMovementTargetId(
      operation
    );
  }

  return null;
};

const isSameSyncOperationTarget = (
  queuedOperation,
  incomingOperation
) => {
  if (
    !queuedOperation ||
    !incomingOperation ||
    queuedOperation.entity !==
      incomingOperation.entity
  ) {
    return false;
  }

  const queuedTargetId =
    getSyncOperationTargetId(
      queuedOperation
    );

  const incomingTargetId =
    getSyncOperationTargetId(
      incomingOperation
    );

  return (
    Boolean(queuedTargetId) &&
    queuedTargetId ===
      incomingTargetId
  );
};

const mergeOperationMetadata = (
  existing,
  incoming
) => ({
  type:
    incoming.type ||
    incoming.payload?.type ||
    existing.type ||
    existing.payload?.type ||
    null,

  goalId:
    incoming.goalId ||
    incoming.payload?.goalId ||
    existing.goalId ||
    existing.payload?.goalId ||
    null,
});

const mergeSyncOperations = (
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

  const metadata =
    mergeOperationMetadata(
      existing,
      incoming
    );

  const now =
    new Date().toISOString();

  /*
   * CREATE + UPDATE
   *
   * Todavía no existe en Supabase.
   * Modificamos directamente el CREATE.
   */
  if (
    existing.action ===
      "create" &&
    incoming.action ===
      "update"
  ) {
    return {
      ...existing,
      ...metadata,

      payload: {
        ...existing.payload,
        ...incoming.payload,
      },

      status:
        "pending",

      conflict:
        null,

      lastUpdatedAt:
        now,
    };
  }

  /*
   * CREATE + DELETE
   *
   * Nunca llegó al servidor.
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
   * CREATE + CREATE
   *
   * Lo dejamos idempotente.
   */
  if (
    existing.action ===
      "create" &&
    incoming.action ===
      "create"
  ) {
    return {
      ...existing,
      ...metadata,

      payload: {
        ...existing.payload,
        ...incoming.payload,
      },

      status:
        "pending",

      conflict:
        null,

      lastUpdatedAt:
        now,
    };
  }

  /*
   * UPDATE + UPDATE
   *
   * Dejamos una sola edición.
   */
  if (
    existing.action ===
      "update" &&
    incoming.action ===
      "update"
  ) {
    return {
      ...existing,
      ...metadata,

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

      status:
        "pending",

      conflict:
        null,

      lastUpdatedAt:
        now,
    };
  }

  /*
   * UPDATE + DELETE
   *
   * Solo necesitamos enviar DELETE.
   */
  if (
    existing.action ===
      "update" &&
    incoming.action ===
      "delete"
  ) {
    return {
      ...incoming,

      /*
       * Mantenemos el mismo id
       * dentro de la cola.
       */
      id:
        existing.id,

      expectedUpdatedAt:
        existing
          .expectedUpdatedAt ||
        incoming
          .expectedUpdatedAt ||
        null,

      queuedAt:
        existing.queuedAt ||
        incoming.queuedAt,

      status:
        "pending",

      conflict:
        null,

      lastUpdatedAt:
        now,
    };
  }

  /*
   * DELETE + DELETE
   */
  if (
    existing.action ===
      "delete" &&
    incoming.action ===
      "delete"
  ) {
    return {
      ...existing,

      status:
        "pending",

      conflict:
        null,

      lastUpdatedAt:
        now,
    };
  }

  /*
   * DELETE + UPDATE
   *
   * Si ya fue eliminado localmente
   * mantenemos el DELETE.
   */
  if (
    existing.action ===
      "delete" &&
    incoming.action ===
      "update"
  ) {
    return existing;
  }

  return incoming;
};

const queueEntitySyncOperation =
  async (
    userId,
    operation,
    expectedEntity
  ) => {
    if (
      !userId ||
      !operation?.id ||
      operation?.entity !==
        expectedEntity ||
      !SUPPORTED_SYNC_ACTIONS
        .includes(
          operation?.action
        )
    ) {
      return false;
    }

    const targetId =
      getSyncOperationTargetId(
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

        const firstMatchIndex =
          currentQueue.findIndex(
            (
              queuedOperation
            ) =>
              isSameSyncOperationTarget(
                queuedOperation,
                operation
              )
          );

        if (
          firstMatchIndex ===
          -1
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
          mergeSyncOperations(
            existingOperation,
            operation
          );

        const nextQueue = [];

        for (
          let index = 0;
          index <
          currentQueue.length;
          index += 1
        ) {
          const queuedOperation =
            currentQueue[
              index
            ];

          const sameTarget =
            isSameSyncOperationTarget(
              queuedOperation,
              operation
            );

          if (!sameTarget) {
            nextQueue.push(
              queuedOperation
            );

            continue;
          }

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

        return nextQueue;
      }
    );
  };

export const getPendingSyncOperations =
  async (
    userId
  ) => {
    if (!userId) {
      return [];
    }

    const record =
      await getRecord(
        getSyncQueueKey(
          userId
        )
      );

    return Array.isArray(
      record?.value
    )
      ? record.value
      : [];
  };

export const queueTransactionSyncOperation =
  async (
    userId,
    operation
  ) => {
    return (
      queueEntitySyncOperation(
        userId,
        operation,
        "transaction"
      )
    );
  };

export const queueGoalMovementSyncOperation =
  async (
    userId,
    operation
  ) => {
    return (
      queueEntitySyncOperation(
        userId,
        operation,
        "goal_movement"
      )
    );
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

    if (
      operation.entity ===
      "goal_movement"
    ) {
      return (
        queueGoalMovementSyncOperation(
          userId,
          operation
        )
      );
    }

    /*
     * Soporte genérico para
     * futuras entidades.
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

        if (
          alreadyExists
        ) {
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

        return (
          currentQueue.filter(
            (item) =>
              item?.id !==
              operationId
          )
        );
      }
    );
  };

export const updatePendingSyncOperation =
  async (
    userId,
    operationId,
    changes
  ) => {
    if (
      !userId ||
      !operationId ||
      !changes
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

        let found = false;

        const nextQueue =
          currentQueue.map(
            (operation) => {
              if (
                operation?.id !==
                operationId
              ) {
                return operation;
              }

              found = true;

              return {
                ...operation,
                ...changes,

                lastUpdatedAt:
                  new Date()
                    .toISOString(),
              };
            }
          );

        return found
          ? nextQueue
          : currentQueue;
      }
    );
  };

export const markPendingSyncConflict =
  async (
    userId,
    operationId,
    conflict
  ) => {
    if (
      !userId ||
      !operationId
    ) {
      return false;
    }

    return (
      updatePendingSyncOperation(
        userId,
        operationId,
        {
          status:
            "conflict",

          conflict: {
            detectedAt:
              new Date()
                .toISOString(),

            message:
              conflict
                ?.message ||
              "El registro fue modificado desde otro dispositivo.",

            /*
             * Para ingresos/gastos.
             */
            serverTransaction:
              conflict
                ?.serverTransaction ||
              null,

            /*
             * Para movimientos
             * de ahorro.
             */
            serverGoalMovement:
              conflict
                ?.serverGoalMovement ||
              null,

            /*
             * También guardamos
             * el objetivo actualizado.
             */
            serverGoal:
              conflict
                ?.serverGoal ||
              null,
          },
        }
      )
    );
  };

export const clearPendingSyncConflict =
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

    return (
      updatePendingSyncOperation(
        userId,
        operationId,
        {
          status:
            "pending",

          conflict:
            null,
        }
      )
    );
  };

export const getPendingSyncConflicts =
  async (
    userId
  ) => {
    if (!userId) {
      return [];
    }

    const operations =
      await getPendingSyncOperations(
        userId
      );

    return (
      operations.filter(
        (operation) =>
          [
            "transaction",
            "goal_movement",
          ].includes(
            operation?.entity
          ) &&
          operation?.status ===
            "conflict"
      )
    );
  };

const removePendingEntityOperations =
  async (
    userId,
    entity,
    targetId
  ) => {
    if (
      !userId ||
      !targetId
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

        return (
          currentQueue.filter(
            (operation) => {
              if (
                operation
                  ?.entity !==
                entity
              ) {
                return true;
              }

              return (
                getSyncOperationTargetId(
                  operation
                ) !==
                targetId
              );
            }
          )
        );
      }
    );
  };

export const removePendingTransactionOperations =
  async (
    userId,
    transactionId
  ) => {
    return (
      removePendingEntityOperations(
        userId,
        "transaction",
        transactionId
      )
    );
  };

export const removePendingGoalMovementOperations =
  async (
    userId,
    goalMovementId
  ) => {
    return (
      removePendingEntityOperations(
        userId,
        "goal_movement",
        goalMovementId
      )
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