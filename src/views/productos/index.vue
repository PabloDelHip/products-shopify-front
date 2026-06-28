<script>
import Layout from "../../layouts/main";
import PageHeader from "@/components/page-header";
import CategorySelectorItem from "@/components/productos/CategorySelectorItem.vue";
import localApiService from "@/services/localApi";
import syscomService from "@/services/syscom";
import Swal from "sweetalert2";

export default {
  components: { Layout, PageHeader, CategorySelectorItem },
  data() {
    return {
      searchQuery: "",
      selectedCategoryId: null,
      selectedCategoryName: "Seleccione una Categoría",
      statusFilter: "all",
      sourceFilter: "syscom", // 'syscom' or 'local'
      // Pagination (API-driven)
      currentPage: 1,
      totalPages: 1,
      totalProducts: 0,
      perPage: 20,
      // UI state
      selectedProductIds: [],
      productPercentages: {},
      loadingCategories: false,
      loadingProducts: false,
      syncingBulk: false,
      // Data
      categories: [],
      products: [],
      categoryAncestors: [], // Store shopify mappings (id, tags)
      // Search debounce
      searchTimeout: null,
    };
  },
  async mounted() {
    await this.fetchCategories();
    this.checkPendingQueue();
  },
  computed: {
    paginatedProducts() {
      // Products are already paginated from the API, just apply local search/status filter
      return this.products
        .filter((product) => {
          const matchesSearch = product.name
            .toLowerCase()
            .includes(this.searchQuery.toLowerCase());
          let matchesStatus = true;
          if (this.statusFilter === "active") matchesStatus = product.active;
          if (this.statusFilter === "inactive") matchesStatus = !product.active;
          return matchesSearch && matchesStatus;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    paginationItems() {
      const total = this.totalPages;
      const current = this.currentPage;
      const delta = 2; // pages shown around current
      const range = [];
      const result = [];
      let last;

      // Always show first, last, and a window around current
      for (let i = 1; i <= total; i++) {
        if (
          i === 1 ||
          i === total ||
          (i >= current - delta && i <= current + delta)
        ) {
          range.push(i);
        }
      }
      for (const page of range) {
        if (last) {
          if (page - last === 2) {
            result.push(last + 1); // fill single gap
          } else if (page - last > 2) {
            result.push("...");
          }
        }
        result.push(page);
        last = page;
      }
      return result;
    },
    isAllSelected: {
      get() {
        return (
          this.paginatedProducts.length > 0 &&
          this.paginatedProducts.every((p) =>
            this.selectedProductIds.includes(p.id)
          )
        );
      },
      set(value) {
        const ids = this.paginatedProducts.map((p) => p.id);
        if (value) {
          this.selectedProductIds = [
            ...new Set([...this.selectedProductIds, ...ids]),
          ];
        } else {
          this.selectedProductIds = this.selectedProductIds.filter(
            (id) => !ids.includes(id)
          );
        }
      },
    },
  },
  methods: {
    async fetchCategories() {
      this.loadingCategories = true;
      try {
        const tree = await localApiService.getCategoryTree();
        const normalize = (nodes) =>
          (nodes || [])
            .filter((node) => node.active === true || node.active === 1)
            .map((node) => ({
              id: node.provider_category_id,
              name: node.name,
              active: node.active,
              level: parseInt(node.level) || 1,
              children: normalize(node.children),
            }));
        this.categories = normalize(tree);
      } catch (error) {
        console.error("Error loading category tree:", error);
      } finally {
        this.loadingCategories = false;
      }
    },

    async selectCategory(categoryId, level) {
      if (this.selectedCategoryId === categoryId) return;
      this.selectedCategoryId = categoryId;
      this.selectedCategoryLevel = level || 1;
      // Find name in tree
      const findName = (nodes) => {
        for (const n of nodes) {
          if (n.id === categoryId) return n.name;
          if (n.children) {
            const f = findName(n.children);
            if (f) return f;
          }
        }
        return categoryId;
      };
      this.selectedCategoryName = findName(this.categories);
      this.selectedProductIds = [];
      this.currentPage = 1;

      // Fetch ancestors to get Shopify Collection ID and Tags
      try {
        this.categoryAncestors = await localApiService.getCategoryAncestors(
          categoryId
        );
      } catch (e) {
        console.error("Error fetching ancestors for sync mapping:", e);
        this.categoryAncestors = [];
      }

      await this.fetchProducts();
    },

    async fetchProducts() {
      if (!this.selectedCategoryId) return;
      this.loadingProducts = true;
      this.products = [];
      try {
        const localFilterId = this.getFilterCategoryId();

        if (this.sourceFilter === "local") {
          // Fetch only from Local DB
          const syncedData = await localApiService.getSyncedProductsByProvider(
            "syscom",
            localFilterId,
            this.currentPage,
            this.perPage
          );

          if (syncedData.ok && syncedData.data) {
            const data = syncedData.data;
            this.totalProducts = data.total || 0;
            this.totalPages =
              data.last_page ||
              Math.ceil(this.totalProducts / this.perPage) ||
              1;

            const localProducts = (data.data || []).map((item) => {
              return {
                id: String(item.external_id),
                name: item.product_name || "Sin nombre",
                brand: item.vendor || "",
                model: item.sku || "",
                sku: item.sku || "",
                price: item.price_amount || 0,
                compare_at_price: item.price_amount || 0,
                image: (item.images && item.images[0]) || null,
                stock: parseInt(item.stock || 0), // Este es el local
                localStock: parseInt(item.stock || 0),
                syscomStock: null, // Se llenará a continuación
                active: item.sync_status === "SUCCESS",
                isSyncing: false,
                isSynced: true,
                lastSyncedAt: item.last_synced_at,
                raw: item,
              };
            });

            // Fetch live Syscom details (stock + images) for these products in parallel
            try {
              const liveDetails = await Promise.all(
                localProducts.map(async (p) => {
                  try {
                    return await syscomService.getProductDetail(p.id);
                  } catch (e) {
                    return null;
                  }
                })
              );
              localProducts.forEach((p, idx) => {
                const detail = liveDetails[idx];
                if (detail) {
                  p.syscomStock = parseInt(
                    detail.total_existencia ?? detail.existencia ?? 0
                  );
                  // Update image if missing from local DB
                  if (!p.image) {
                    p.image =
                      detail.img_portada ||
                      (detail.imagenes && detail.imagenes[0]?.imagen) ||
                      detail.imagen;
                  }
                }
              });
            } catch (e) {
              console.warn("Could not fetch live Syscom details", e);
            }

            this.products = localProducts;
          }
        } else {
          // Fetch from Syscom + Cross-reference (Original Logic)
          const [syscomData, syncedData] = await Promise.all([
            syscomService.getProducts({
              categoria: this.selectedCategoryId,
              pagina: this.currentPage,
              porPagina: this.perPage,
            }),
            localApiService.getSyncedProductsByProvider(
              "syscom",
              localFilterId,
              1, // We only need a slice to check sync status in 'syscom' view, but for full cross-check we might need more. For now, 1st page.
              50 // A larger batch to increase match chances
            ),
          ]);

          const raw = syscomData.productos || syscomData || [];
          this.totalProducts = syscomData.total || raw.length;
          this.totalPages =
            syscomData.paginas ||
            Math.ceil(this.totalProducts / this.perPage) ||
            1;

          // Map synced products for easy lookup
          const syncedMap = new Map();
          if (syncedData.ok && syncedData.data && syncedData.data.data) {
            syncedData.data.data.forEach((item) => {
              syncedMap.set(String(item.external_id), item);
            });
          }

          this.products = raw.map((p) => {
            const externalId = String(p.producto_id || p.id);
            const syncedRecord = syncedMap.get(externalId);

            // Normalize image from list view
            const listImage =
              p.img_portada ||
              p.imagen ||
              (p.imagenes &&
                p.imagenes[0] &&
                (p.imagenes[0].imagen || p.imagenes[0])) ||
              null;

            return {
              id: externalId,
              name: p.titulo || p.nombre || p.name || "Sin nombre",
              brand: p.marca || "",
              model: p.modelo || "",
              sku: p.modelo || p.sku || "",
              price:
                p.precios?.precio_descuento ||
                p.precios?.precio_lista ||
                p.precio ||
                0,
              compare_at_price: p.precios?.precio_lista || 0,
              image: listImage,
              stock: syncedRecord
                ? parseInt(syncedRecord.stock || 0)
                : parseInt(p.total_existencia ?? p.existencia ?? 0),
              localStock: syncedRecord
                ? parseInt(syncedRecord.stock || 0)
                : null,
              syscomStock: parseInt(p.total_existencia ?? p.existencia ?? 0),
              active: true,
              isSyncing: false,
              isSynced:
                !!syncedRecord && syncedRecord.sync_status === "SUCCESS",
              lastSyncedAt: syncedRecord ? syncedRecord.last_synced_at : null,
              raw: p,
            };
          });
        }
      } catch (error) {
        console.error("Error loading products:", error);
        this.products = [];
      } finally {
        this.loadingProducts = false;
      }
    },

    getFilterCategoryId() {
      // If current category is Level 3, try to find the Level 2 ancestor to filter in Local API
      if (this.selectedCategoryLevel === 3) {
        const level2 = this.categoryAncestors.find(
          (anc) => parseInt(anc.level) === 2
        );
        if (level2) return level2.provider_category_id || level2.id;
      }
      return this.selectedCategoryId;
    },

    formatDate(dateString) {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return date.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    mapProductToShopify(p, pricePercentage) {
      // Tags normalization
      let tags = [
        "syscom",
        p.brand ? p.brand.toLowerCase() : "",
        this.selectedCategoryName
          ? this.selectedCategoryName.toLowerCase()
          : "",
      ];
      if (p.model) tags.push(p.model.toLowerCase());

      // Add Shopify IDs from ancestors (Level 2+) as tags
      const extraTags = this.categoryAncestors
        .filter((anc) => anc.level >= 2 && anc.shopify_id)
        .map((anc) => anc.shopify_id);

      tags = [...new Set([...tags, ...extraTags])].filter((t) => t);

      // Find Collection ID (Level 1)
      const level1 = this.categoryAncestors.find((anc) => anc.level === 1);
      const collectionId = level1 ? level1.shopify_id : null;

      // Image extraction
      const productImages = [];
      if (p.raw?.img_portada) productImages.push(p.raw.img_portada);
      if (p.raw?.imagenes && Array.isArray(p.raw.imagenes)) {
        p.raw.imagenes.forEach((imgObj) => {
          if (imgObj.imagen) productImages.push(imgObj.imagen);
        });
      }
      // Fallback to the image captured in list view if still empty
      if (productImages.length === 0 && p.image) productImages.push(p.image);

      // Filter unique and valid URLs
      const finalImages = [...new Set(productImages)].filter(
        (url) => typeof url === "string" && url.startsWith("http")
      );

      return {
        external_id: String(p.id),
        provider: "syscom",
        price_percentage: parseFloat(pricePercentage) || 0,
        title: p.name,
        vendor: p.brand || "Generico",
        product_type: String(this.selectedCategoryId),
        description_html: `<p>${p.name}. Marca: ${p.brand}. Modelo: ${p.model}.</p>`,
        status: "ACTIVE",
        tags: tags,
        images: finalImages,
        categorias: p.raw?.categorias || [],
        variants: [
          {
            sku: p.sku || `SYS-${p.id}`,
            price: parseFloat(p.price),
            compare_at_price: parseFloat(p.compare_at_price || p.price),
            inventory_quantity: parseInt(p.stock) || 0,
            inventory_management: "SHOPIFY",
            requires_shipping: true,
            taxable: true,
          },
        ],
        collections: collectionId ? [{ id: collectionId }] : [],
        metafields: {
          syscom_producto_id: String(p.id),
          syscom_modelo: p.model,
          syscom_sat_key: p.raw?.sat_key || "",
          syscom_link: p.raw?.link || "",
          syscom_total_existencia: parseInt(p.stock) || 0,
          syscom_precio_lista: parseFloat(p.compare_at_price || p.price),
          syscom_precio_descuento: parseFloat(p.price),
          syscom_caracteristicas: p.raw?.caracteristicas || [],
          syscom_recursos: p.raw?.recursos || [],
        },
      };
    },

    async goToPage(page) {
      if (page < 1 || page > this.totalPages) return;
      this.currentPage = page;
      await this.fetchProducts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },

    viewProduct(product) {
      Swal.fire({
        title: product.name,
        html: `
          <div class="text-start">
            <p><strong>Marca:</strong> ${product.brand}</p>
            <p><strong>Modelo:</strong> ${product.model}</p>
            <p><strong>SKU:</strong> ${product.sku}</p>
            <p><strong>Precio:</strong> $${Number(product.price).toLocaleString(
              "es-MX"
            )}</p>
            <p><strong>Stock:</strong> ${product.stock}</p>
          </div>
        `,
        imageUrl: product.image,
        imageHeight: 200,
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#556ee6",
      });
    },

    async syncProduct(product) {
      if (product.isSyncing) return;

      // Resolve percentage: use already-captured value or prompt the user
      let percentage = this.productPercentages[product.id];
      if (percentage === null || percentage === undefined || percentage === "") {
        const { value, isConfirmed } = await Swal.fire({
          title: "Porcentaje de precio",
          input: "number",
          inputLabel: `Ingresa el % de precio para "${product.name}"`,
          inputPlaceholder: "Ej: 15",
          inputAttributes: { min: 0, step: 0.1 },
          showCancelButton: true,
          confirmButtonText: "Continuar",
          cancelButtonText: "Cancelar",
          inputValidator: (v) => {
            if (v === "" || v === null || v === undefined)
              return "El porcentaje es obligatorio";
          },
        });
        if (!isConfirmed) return;
        percentage = parseFloat(value);
        this.productPercentages[product.id] = percentage;
      }

      product.isSyncing = true;
      Swal.fire({
        title: "Subiendo producto...",
        text: "Obteniendo detalles and sincronizando...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      try {
        // Fetch full detail to get SAT key, resources, etc if missing
        const detail = await syscomService.getProductDetail(product.id);
        product.raw = { ...product.raw, ...detail };

        const payload = this.mapProductToShopify(product, percentage);
        await localApiService.syncProducts([payload]);

        // Trigger Shopify processing for this single product
        try {
          await localApiService.processProductUploads(1);
        } catch (e) {
          console.error("Delayed process failed, but sync was ok:", e);
        }

        product.isSynced = true;
        product.lastSyncedAt = new Date().toISOString();
        Swal.fire({
          icon: "success",
          title: "Sincronizado",
          text: `Producto subido exitosamente a Shopify.`,
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Error syncing product:", error);
        Swal.fire("Error", "No se pudo subir el producto.", "error");
      } finally {
        product.isSyncing = false;
      }
    },

    async bulkUpload() {
      if (this.selectedProductIds.length === 0 || this.syncingBulk) return;

      const productsToSync = this.products.filter((p) =>
        this.selectedProductIds.includes(p.id)
      );

      if (productsToSync.length === 0) {
        Swal.fire(
          "Información",
          "Los productos seleccionados ya están sincronizados.",
          "info"
        );
        return;
      }

      // Validate that every product has a percentage set
      const missingPercentage = productsToSync.filter((p) => {
        const pct = this.productPercentages[p.id];
        return pct === null || pct === undefined || pct === "";
      });
      if (missingPercentage.length > 0) {
        Swal.fire({
          icon: "warning",
          title: "Porcentaje requerido",
          html: `Los siguientes productos no tienen porcentaje de precio:<br><br><strong>${missingPercentage.map((p) => p.name).join("<br>")}</strong>`,
          confirmButtonColor: "#556ee6",
        });
        return;
      }

      const result = await Swal.fire({
        title: "¿Sincronizar lote?",
        text: `Se procesarán ${productsToSync.length} productos a la base de datos y luego a Shopify (se actualizarán los existentes).`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#34c38f",
        cancelButtonColor: "#f46a6a",
        confirmButtonText: "Sí, iniciar",
        cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) return;

      this.syncingBulk = true;

      // Progress bar Modal
      Swal.fire({
        title: "Sincronización en curso",
        html: `
          <p id="swal-msg" class="mb-2">Preparando datos...</p>
          <div class="progress mb-3" style="height: 10px;">
            <div id="swal-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                 role="progressbar" style="width: 0%"></div>
          </div>
          <small id="swal-count" class="text-muted">0 de ${productsToSync.length}</small>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const updateUI = (percent, msg, countText) => {
        const bar = document.getElementById("swal-progress");
        const text = document.getElementById("swal-msg");
        const count = document.getElementById("swal-count");
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.innerText = msg;
        if (count && countText) count.innerText = countText;
      };

      try {
        const payloads = [];
        let count = 0;

        // Step 1: Fetch Details (0-45%)
        for (const p of productsToSync) {
          p.isSyncing = true;
          count++;
          const progress = Math.round((count / productsToSync.length) * 45);
          updateUI(
            progress,
            `Obteniendo detalles de Syscom...`,
            `${count} de ${productsToSync.length}`
          );

          try {
            const detail = await syscomService.getProductDetail(p.id);
            p.raw = { ...p.raw, ...detail };
            payloads.push(this.mapProductToShopify(p, this.productPercentages[p.id]));
          } catch (e) {
            console.warn(`Detail fetch failed for ${p.id}`, e);
            payloads.push(this.mapProductToShopify(p, this.productPercentages[p.id]));
          }
        }

        // Step 2: Save to Local DB (45-60%)
        updateUI(
          50,
          `Guardando en base de datos local...`,
          `Lote de ${payloads.length}`
        );
        await localApiService.syncProducts(payloads);

        // Step 3: Loop Process to Shopify (60-100%)
        updateUI(60, `Enviando a Shopify (procesando cola)...`, `Iniciando...`);

        let finished = false;
        let cycles = 0;
        while (!finished) {
          cycles++;
          const response = await localApiService.processProductUploads(4);
          const data = response.data || {};

          // Logic: check remaining_total or similar
          const remaining = data.remaining_total ?? data.pending_remaining;

          if (
            remaining !== undefined &&
            remaining !== null &&
            parseInt(remaining) > 0
          ) {
            const pBase = 60;
            const pMax = 98;
            // Incremental progress placeholder
            const progress = Math.min(pBase + cycles * 5, pMax);
            updateUI(
              progress,
              `Procesando en Shopify...`,
              `${remaining} productos pendientes`
            );

            // Wait 1.5s between cycles to avoid overloading or to let Shopify process
            await new Promise((r) => setTimeout(r, 1500));
          } else {
            finished = true;
          }

          // Safety break after 50 cycles
          if (cycles > 50) finished = true;
        }

        updateUI(100, `¡Completado!`, ``);

        productsToSync.forEach((p) => {
          p.isSynced = true;
          p.isSyncing = false;
          p.lastSyncedAt = new Date().toISOString();
        });
        this.selectedProductIds = [];

        Swal.fire({
          icon: "success",
          title: "Sincronización Exitosa",
          text: `Se han subido y procesado ${productsToSync.length} productos correctamente.`,
          confirmButtonColor: "#34c38f",
        });
      } catch (error) {
        console.error("Error in bulk sync:", error);
        Swal.fire(
          "Error",
          "Ocurrió un error durante la sincronización masiva.",
          "error"
        );
        productsToSync.forEach((p) => (p.isSyncing = false));
      } finally {
        this.syncingBulk = false;
      }
    },

    async checkPendingQueue() {
      try {
        const metricsData = await localApiService.getUploadMetrics();
        const metrics = metricsData.data;

        // Si hay pendientes, disparamos el flujo de procesamiento (que ya pide confirmación)
        if (metrics && metrics.pending > 0) {
          this.processPendingQueue(true); // Pasamos true para indicar que ya sabemos que hay pendientes
        }
      } catch (error) {
        console.error("Error checking pending queue on start:", error);
      }
    },

    async processPendingQueue(skipCheck = false) {
      try {
        let metrics;
        if (skipCheck) {
          // Si venimos de checkPendingQueue, ya sabemos que hay, pero refrescamos por si acaso
          const metricsData = await localApiService.getUploadMetrics();
          metrics = metricsData.data;
        } else {
          const metricsData = await localApiService.getUploadMetrics();
          metrics = metricsData.data;

          if (!metrics || metrics.pending === 0) {
            Swal.fire({
              icon: "info",
              title: "Nada pendiente",
              text: "No hay productos en la cola de subida a Shopify.",
              timer: 2000,
              showConfirmButton: false,
            });
            return;
          }
        }

        if (!metrics || metrics.pending === 0) return;

        const result = await Swal.fire({
          title: "Productos Pendientes",
          text: `Se encontraron ${metrics.pending} productos pendientes de procesar. ¿Deseas iniciar la subida ahora?`,
          icon: "info",
          showCancelButton: true,
          confirmButtonColor: "#34c38f",
          cancelButtonColor: "#f46a6a",
          confirmButtonText: "Sí, procesar",
          cancelButtonText: "Ahora no",
        });

        if (!result.isConfirmed) return;

        this.syncingBulk = true;

        // Reuse progress UI
        Swal.fire({
          title: "Procesando Cola de Shopify",
          html: `
            <p id="swal-msg" class="mb-2">Iniciando procesamiento...</p>
            <div class="progress mb-3" style="height: 10px;">
              <div id="swal-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                   role="progressbar" style="width: 0%"></div>
            </div>
            <small id="swal-count" class="text-muted">Pendientes: ${metrics.pending}</small>
          `,
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const updateUI = (percent, msg, countText) => {
          const bar = document.getElementById("swal-progress");
          const text = document.getElementById("swal-msg");
          const count = document.getElementById("swal-count");
          if (bar) bar.style.width = `${percent}%`;
          if (text) text.innerText = msg;
          if (count && countText) count.innerText = countText;
        };

        let pendingCount = metrics.pending;
        const totalToProcess = metrics.pending;
        let cycles = 0;

        while (pendingCount > 0) {
          cycles++;
          const response = await localApiService.processProductUploads(4);
          const data = response.data || {};

          pendingCount = data.remaining_total ?? data.pending_remaining;

          if (pendingCount === undefined || pendingCount === null) {
            // Re-check metrics if the process response doesn't give us the count
            const updatedMetrics = await localApiService.getUploadMetrics();
            pendingCount = updatedMetrics.data.pending;
          }

          const progress = Math.min(
            Math.round(
              ((totalToProcess - pendingCount) / totalToProcess) * 100
            ),
            99
          );
          updateUI(
            progress,
            `Sincronizando con Shopify...`,
            `${pendingCount} restantes`
          );

          if (pendingCount > 0) {
            await new Promise((r) => setTimeout(r, 1500));
          }

          if (cycles > 100) break; // Safety break
        }

        updateUI(100, `¡Completado!`, `0 restantes`);

        Swal.fire({
          icon: "success",
          title: "Proceso Finalizado",
          text: `Se han procesado todos los productos pendientes.`,
          confirmButtonColor: "#34c38f",
        });

        this.fetchProducts(); // Refresh list to see new statuses
      } catch (error) {
        console.error("Error in queue processing:", error);
        Swal.fire("Error", "Ocurrió un error al procesar la cola.", "error");
      } finally {
        this.syncingBulk = false;
      }
    },
    async deleteProduct(product) {
      const result = await Swal.fire({
        title: "¿Eliminar producto?",
        html: `¿Estás seguro de que deseas eliminar <strong>${product.name}</strong>? Esta acción no se puede deshacer.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#f46a6a",
        cancelButtonColor: "#74788d",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) return;

      try {
        await localApiService.deleteProduct("syscom", product.id);
        this.products = this.products.filter((p) => p.id !== product.id);
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: "El producto fue eliminado correctamente.",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Error eliminando producto:", error);
        Swal.fire("Error", "No se pudo eliminar el producto.", "error");
      }
    },
  },
  watch: {
    searchQuery() {
      // Client-side search on already loaded products — no need to re-fetch
    },
    statusFilter() {
      this.selectedProductIds = [];
    },
    selectedProductIds(newIds) {
      newIds.forEach((id) => {
        if (this.productPercentages[id] === undefined) {
          this.productPercentages[id] = null;
        }
      });
    },
    sourceFilter() {
      this.currentPage = 1;
      this.fetchProducts();
    },
  },
};
</script>

<template>
  <Layout>
    <PageHeader title="Productos" pageTitle="Módulo" />
    <div class="row">
      <!-- Sidebar: Categories -->
      <div class="col-lg-3">
        <div class="card">
          <div class="card-body">
            <h4 class="card-title mb-3">Mis Categorías</h4>
            <div class="border rounded overflow-hidden">
              <!-- Loading -->
              <div v-if="loadingCategories" class="text-center py-4">
                <div
                  class="spinner-border spinner-border-sm text-primary"
                  role="status"
                ></div>
                <p class="text-muted font-size-12 mt-2 mb-0">Cargando...</p>
              </div>
              <!-- Empty state -->
              <div
                v-else-if="categories.length === 0"
                class="text-center py-4 px-3"
              >
                <i class="bx bx-category font-size-24 text-muted"></i>
                <p class="text-muted font-size-12 mt-2 mb-0">
                  No hay categorías activas.<br />
                  <router-link to="/categorias" class="text-primary"
                    >Ir a Categorías</router-link
                  >
                </p>
              </div>
              <!-- Tree -->
              <ul v-else class="list-unstyled mb-0">
                <CategorySelectorItem
                  v-for="category in categories"
                  :key="category.id"
                  :category="category"
                  :selectedCategoryId="selectedCategoryId"
                  @select-category="selectCategory"
                />
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="col-lg-9">
        <div class="card">
          <div class="card-body">
            <template v-if="selectedCategoryId">
              <div class="row mb-4 align-items-center">
                <div class="col-sm-4">
                  <h4 class="card-title mb-1">{{ selectedCategoryName }}</h4>
                  <p class="text-muted mb-0 font-size-13">
                    {{ totalProducts }} productos encontrados
                  </p>
                </div>
                <div class="col-sm-8 text-sm-end">
                  <div
                    class="d-flex flex-wrap gap-2 justify-content-sm-end mt-3 mt-sm-0"
                  >
                    <div class="search-box me-2">
                      <div class="position-relative">
                        <input
                          type="text"
                          class="form-control"
                          placeholder="Buscar..."
                          v-model="searchQuery"
                        />
                        <i class="bx bx-search-alt search-icon"></i>
                      </div>
                    </div>

                    <button
                      class="btn btn-soft-warning me-2"
                      @click="processPendingQueue"
                      title="Procesar productos pendientes en el servidor"
                    >
                      <i class="bx bx-timer me-1"></i> Cola
                    </button>

                    <!-- Filtro de Origen -->
                    <div class="btn-group me-2" role="group">
                      <input
                        type="radio"
                        class="btn-check"
                        name="source-radio"
                        id="src-sys"
                        value="syscom"
                        v-model="sourceFilter"
                      />
                      <label class="btn btn-outline-primary" for="src-sys">
                        <i class="bx bx-world me-1"></i> Syscom
                      </label>
                      <input
                        type="radio"
                        class="btn-check"
                        name="source-radio"
                        id="src-loc"
                        value="local"
                        v-model="sourceFilter"
                      />
                      <label class="btn btn-outline-success" for="src-loc">
                        <i class="bx bx-check-double me-1"></i> Sincronizados
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="selectedProductIds.length > 0"
                class="alert alert-primary d-flex align-items-center mb-4 shadow-sm border-0"
              >
                <div class="flex-grow-1">
                  <i class="bx bx-check-double me-2 font-size-18"></i>
                  Seleccionados:
                  <strong>{{ selectedProductIds.length }}</strong> productos.
                </div>
                <button
                  class="btn btn-primary btn-sm px-4"
                  @click="bulkUpload"
                  :disabled="syncingBulk"
                >
                  <i v-if="syncingBulk" class="bx bx-loader bx-spin me-1"></i>
                  <i v-else class="bx bx-cloud-upload me-1"></i>
                  {{ syncingBulk ? "Subiendo..." : "Subir Lote" }}
                </button>
              </div>

              <!-- Loading products -->
              <div v-if="loadingProducts" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2">Cargando productos de Syscom...</p>
              </div>

              <div v-else class="table-responsive product-table-scroll">
                <table class="table align-middle table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th style="width: 40px">
                        <div class="form-check font-size-16">
                          <input
                            class="form-check-input"
                            type="checkbox"
                            v-model="isAllSelected"
                          />
                        </div>
                      </th>
                      <th>Producto</th>
                      <th>Marca / Modelo</th>
                      <th>Precio</th>
                      <th style="min-width: 120px">% Precio</th>
                      <th style="min-width: 140px">Stock (Local / Syscom)</th>
                      <th>Última Sinc.</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="product in paginatedProducts"
                      :key="product.id"
                      :class="{
                        'bg-primary-subtle bg-opacity-10':
                          selectedProductIds.includes(product.id),
                        'row-synced':
                          product.isSynced && sourceFilter === 'syscom',
                      }"
                    >
                      <td>
                        <div class="form-check font-size-16">
                          <input
                            class="form-check-input"
                            type="checkbox"
                            :value="product.id"
                            v-model="selectedProductIds"
                          />
                        </div>
                      </td>
                      <td>
                        <div class="d-flex align-items-center">
                          <div
                            class="me-3"
                            style="width: 40px; height: 40px; flex-shrink: 0"
                          >
                            <img
                              v-if="product.image"
                              :src="product.image"
                              alt=""
                              style="
                                width: 40px;
                                height: 40px;
                                object-fit: contain;
                                border-radius: 4px;
                              "
                            />
                            <div
                              v-else
                              class="avatar-title rounded bg-soft-primary text-primary font-size-14"
                              style="
                                width: 40px;
                                height: 40px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                              "
                            >
                              {{ product.name.charAt(0) }}
                            </div>
                          </div>
                          <div>
                            <h5 class="font-size-13 mb-0">
                              {{ product.name }}
                            </h5>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="fw-medium">{{ product.brand }}</span
                        ><br />
                        <span class="text-muted font-size-12">{{
                          product.model
                        }}</span>
                      </td>
                      <td class="fw-medium">
                        ${{ Number(product.price).toLocaleString("es-MX") }}
                      </td>
                      <td>
                        <div
                          v-if="selectedProductIds.includes(product.id)"
                          class="input-group input-group-sm"
                          style="max-width: 105px"
                        >
                          <input
                            type="number"
                            class="form-control form-control-sm"
                            :class="{
                              'is-invalid':
                                selectedProductIds.includes(product.id) &&
                                (productPercentages[product.id] === null ||
                                  productPercentages[product.id] === undefined ||
                                  productPercentages[product.id] === ''),
                            }"
                            placeholder="0"
                            min="0"
                            step="0.1"
                            v-model.number="productPercentages[product.id]"
                          />
                          <span class="input-group-text">%</span>
                        </div>
                        <span v-else class="text-muted font-size-12">—</span>
                      </td>
                      <td>
                        <div class="d-flex flex-column gap-1">
                          <div
                            class="d-flex justify-content-between align-items-center"
                            style="min-width: 110px"
                          >
                            <small class="text-muted me-2">Local:</small>
                            <span
                              :class="
                                product.localStock > 0
                                  ? 'badge badge-soft-success font-size-11'
                                  : 'badge badge-soft-danger font-size-11'
                              "
                            >
                              {{
                                product.localStock !== null
                                  ? product.localStock
                                  : "---"
                              }}
                            </span>
                          </div>
                          <div
                            class="d-flex justify-content-between align-items-center"
                            style="min-width: 110px"
                          >
                            <small class="text-muted me-2">Syscom:</small>
                            <span
                              v-if="product.syscomStock !== null"
                              :class="
                                product.syscomStock > 0
                                  ? 'text-primary fw-medium font-size-11'
                                  : 'text-danger fw-medium font-size-11'
                              "
                            >
                              {{ product.syscomStock }}
                            </span>
                            <span v-else class="text-muted font-size-10 italic"
                              >Cargando...</span
                            >
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="text-muted font-size-12">
                          {{ formatDate(product.lastSyncedAt) }}
                        </span>
                      </td>
                      <td>
                        <div class="d-flex gap-2">
                          <button
                            class="btn btn-soft-info btn-sm"
                            @click="viewProduct(product)"
                            title="Ver Detalle"
                          >
                            <i class="bx bx-show"></i>
                          </button>
                          <button
                            class="btn btn-soft-success btn-sm"
                            @click="syncProduct(product)"
                            :disabled="product.isSyncing"
                            :title="
                              product.isSynced
                                ? 'Actualizar en Shopify'
                                : 'Subir a Shopify'
                            "
                          >
                            <i
                              v-if="product.isSyncing"
                              class="bx bx-loader bx-spin"
                            ></i>
                            <i
                              v-else
                              :class="
                                product.isSynced ? 'bx bx-sync' : 'bx bx-upload'
                              "
                            ></i>
                          </button>
                          <button
                            v-if="sourceFilter === 'local'"
                            class="btn btn-soft-danger btn-sm"
                            @click="deleteProduct(product)"
                            title="Eliminar producto sincronizado"
                          >
                            <i class="bx bx-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr
                      v-if="paginatedProducts.length === 0 && !loadingProducts"
                    >
                      <td colspan="8" class="text-center py-5">
                        <i
                          class="bx bx-package font-size-36 text-muted mb-2"
                        ></i>
                        <p class="text-muted">
                          No se encontraron productos en esta categoría.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div
                class="d-flex align-items-center justify-content-between mt-4"
                v-if="totalPages > 1"
              >
                <span class="text-muted font-size-13">
                  Página <strong>{{ currentPage }}</strong> de
                  <strong>{{ totalPages }}</strong> &nbsp;·&nbsp;
                  {{ totalProducts }} productos
                </span>
                <ul class="pagination pagination-rounded mb-0 flex-wrap">
                  <!-- Prev -->
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a
                      href="javascript:void(0);"
                      class="page-link"
                      @click="goToPage(currentPage - 1)"
                    >
                      <i class="bx bx-chevron-left"></i>
                    </a>
                  </li>
                  <!-- Pages with ellipsis -->
                  <li
                    v-for="(item, idx) in paginationItems"
                    :key="idx"
                    :class="[
                      'page-item',
                      item === '...' ? 'disabled' : '',
                      currentPage === item ? 'active' : '',
                    ]"
                  >
                    <span v-if="item === '...'" class="page-link">…</span>
                    <a
                      v-else
                      href="javascript:void(0);"
                      class="page-link"
                      @click="goToPage(item)"
                      >{{ item }}</a
                    >
                  </li>
                  <!-- Next -->
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a
                      href="javascript:void(0);"
                      class="page-link"
                      @click="goToPage(currentPage + 1)"
                    >
                      <i class="bx bx-chevron-right"></i>
                    </a>
                  </li>
                </ul>
              </div>
            </template>
            <div v-else class="text-center py-5">
              <div class="avatar-md mx-auto mb-4">
                <div
                  class="avatar-title bg-light rounded-circle text-primary font-size-24"
                >
                  <i class="bx bx-category"></i>
                </div>
              </div>
              <h5 class="text-dark">Seleccione una Categoría</h5>
              <p class="text-muted mx-auto" style="max-width: 400px">
                Por favor, elija una categoría del menú lateral para visualizar
                y gestionar los productos asociados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<style scoped>
.hover-bg:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
.pointer-cursor {
  cursor: pointer;
}
.search-box .search-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: #adb5bd;
}
.search-box input {
  padding-left: 38px;
}
.avatar-xs {
  height: 2rem;
  width: 2rem;
}
.avatar-md {
  height: 4rem;
  width: 4rem;
}
.transition-all {
  transition: all 0.3s ease;
}
.product-table-scroll {
  max-height: 520px;
  overflow-y: auto;
}
.product-table-scroll thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: #f8f9fa;
}

/* Subtitles Sync Color */
.row-synced td {
  background-color: rgba(
    52,
    195,
    143,
    0.15
  ) !important; /* Slightly more visible but still tenue */
}

/* Premium Hover Effect */
.table-hover tbody tr:hover td {
  background-color: rgba(
    85,
    110,
    230,
    0.08
  ) !important; /* More distinct but clean hover */
  transition: background-color 0.2s ease;
}

/* Ensure selected rows have priority */
tr.bg-primary-subtle td {
  background-color: rgba(85, 110, 230, 0.15) !important;
}
</style>
