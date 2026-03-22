<script>
import Layout from "../../layouts/main";
import PageHeader from "@/components/page-header";
import CategoryItem from "@/components/categorias/CategoryItem.vue";
import syscomService from "@/services/syscom";
import localApiService from "@/services/localApi";

export default {
  components: { Layout, PageHeader, CategoryItem },
  data() {
    return {
      searchQuery: "",
      statusFilter: "all", // all, active, inactive
      currentPage: 1,
      perPage: 10,
      loadingSyscom: false,
      loadingCategories: false,
      syscomToken: null,
      categories: [],
      localCategories: [],
    };
  },
  async mounted() {
    await this.fetchRootCategories();
  },
  computed: {
    filteredCategories() {
      const query = this.searchQuery.toLowerCase();

      const filterRecursive = (items) => {
        return items.filter((item) => {
          // Check name match
          const nameMatches = item.name.toLowerCase().includes(query);

          // Check status match
          let statusMatches = true;
          if (this.statusFilter === "active")
            statusMatches = item.active === true;
          if (this.statusFilter === "inactive")
            statusMatches = item.active === false;

          // Child processing
          const filteredChildren = item.children
            ? filterRecursive(item.children)
            : [];
          const childrenMatch = filteredChildren.length > 0;

          // Should we keep this item?
          // If we are searching, we show if it matches or children match.
          // If we are filtering status, it's slightly different.
          if (query) {
            return nameMatches || childrenMatch;
          } else {
            // Only status filter
            return statusMatches || childrenMatch;
          }
        });
      };

      return filterRecursive(this.categories);
    },
    paginatedCategories() {
      const start = (this.currentPage - 1) * this.perPage;
      const end = Math.min(
        start + this.perPage,
        this.filteredCategories.length
      );
      return this.filteredCategories.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.filteredCategories.length / this.perPage);
    },
    totalResults() {
      return this.filteredCategories.length;
    },
  },
  methods: {
    async fetchRootCategories() {
      this.loadingCategories = true;
      try {
        const [syscomData, localData] = await Promise.all([
          syscomService.getCategories(),
          localApiService.getCategories(),
        ]);

        this.localCategories = localData;

        this.categories = syscomData.map((cat) => {
          const localMatch = this.localCategories.find(
            (lc) => String(lc.provider_category_id) === String(cat.id)
          );
          return {
            id: cat.id,
            name: cat.nombre,
            active: localMatch ? Boolean(localMatch.active) : false,
            localId: localMatch ? localMatch.id : null,
            children: [],
            hasChildren: true,
            level: cat.nivel,
          };
        });
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        this.loadingCategories = false;
      }
    },
    async toggleCategoryStatus({ category, ancestors }) {
      try {
        const newStatus = !category.active;

        // Build list: ancestors that need to be activated first + the category itself
        // We only need to create ancestors when activating (not deactivating)
        if (newStatus) {
          // Create any missing ancestors first, sorted by level (1 first)
          const missingAncestors = (ancestors || []).filter(
            (anc) => !anc.localId
          );
          if (missingAncestors.length > 0) {
            const ancestorPayload = missingAncestors.map((anc) => ({
              provider: "syscom",
              provider_category_id: String(anc.id),
              name: anc.name,
              level: parseInt(anc.level) || 1,
              ...(anc.parentId ? { parent_id: String(anc.parentId) } : {}),
            }));
            const ancestorResp = await localApiService.createCategories(
              ancestorPayload
            );
            if (ancestorResp.ok && ancestorResp.data) {
              ancestorResp.data.forEach((saved) => {
                // Mark ancestors as active in our local cache
                const anc = ancestors.find(
                  (a) => String(a.id) === String(saved.provider_category_id)
                );
                if (anc) {
                  anc.localId = saved.id;
                  anc.active = true;
                }
                this.localCategories.push(saved);
              });
            }
          }

          // Also activate inactive ancestors that already exist in DB
          for (const anc of ancestors || []) {
            if (anc.localId && !anc.active) {
              await localApiService.toggleCategoryStatus(anc.localId, true);
              anc.active = true;
            }
          }
        }

        // Now handle the category itself
        if (category.localId) {
          await localApiService.toggleCategoryStatus(
            category.localId,
            newStatus
          );
          category.active = newStatus;
        } else if (newStatus) {
          // Category doesn't exist yet — create it
          const payload = [
            {
              provider: "syscom",
              provider_category_id: String(category.id),
              name: category.name,
              level: parseInt(category.level) || 1,
              ...(category.parentId
                ? { parent_id: String(category.parentId) }
                : {}),
            },
          ];
          const response = await localApiService.createCategories(payload);
          if (response.ok && response.data && response.data.length > 0) {
            category.active = true;
            category.localId = response.data[0].id;
            this.localCategories.push(response.data[0]);
          }
        }
      } catch (error) {
        console.error("Error toggling category:", error);
        alert("Error al sincronizar el estado con la API local.");
      }
    },
    async testSyscom() {
      this.loadingSyscom = true;
      try {
        const token = await syscomService.authenticate();
        this.syscomToken = token;
        alert("¡Conexión exitosa! Token obtenido correctamente.");
      } catch (error) {
        alert(
          "Error al conectar con Syscom. Revisa las credenciales en el archivo .env o la consola."
        );
      } finally {
        this.loadingSyscom = false;
      }
    },
  },
  watch: {
    searchQuery() {
      this.currentPage = 1;
    },
    statusFilter() {
      this.currentPage = 1;
    },
  },
};
</script>

<template>
  <Layout>
    <PageHeader title="Categorías" pageTitle="Módulo" />
    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <div class="row mb-4 align-items-center">
              <div class="col-md-4">
                <div class="search-box me-2 d-inline-block w-100">
                  <div class="position-relative">
                    <input
                      type="text"
                      class="form-control"
                      placeholder="Buscar categoría..."
                      v-model="searchQuery"
                    />
                    <i class="bx bx-search-alt search-icon"></i>
                  </div>
                </div>
              </div>
              <div class="col-md-8">
                <div class="d-flex justify-content-md-end mt-3 mt-md-0 gap-2">
                  <!-- <button
                    class="btn btn-info"
                    @click="testSyscom"
                    :disabled="loadingSyscom"
                  >
                    <i class="bx bx-key me-1"></i>
                    {{
                      loadingSyscom
                        ? "Obteniendo Token..."
                        : "Probar Conexión Syscom"
                    }}
                  </button> -->
                  <div class="btn-group" role="group">
                    <input
                      type="radio"
                      class="btn-check"
                      name="status-filter"
                      id="filter-all"
                      value="all"
                      v-model="statusFilter"
                      checked
                    />
                    <label class="btn btn-outline-secondary" for="filter-all"
                      >Todas</label
                    >

                    <input
                      type="radio"
                      class="btn-check"
                      name="status-filter"
                      id="filter-active"
                      value="active"
                      v-model="statusFilter"
                    />
                    <label class="btn btn-outline-success" for="filter-active"
                      >Activas</label
                    >

                    <input
                      type="radio"
                      class="btn-check"
                      name="status-filter"
                      id="filter-inactive"
                      value="inactive"
                      v-model="statusFilter"
                    />
                    <label class="btn btn-outline-danger" for="filter-inactive"
                      >Inactivas</label
                    >
                  </div>
                </div>
              </div>
            </div>

            <div class="d-flex align-items-center mb-3">
              <h4 class="card-title flex-grow-1">Visor de Categorías</h4>
              <div class="text-muted font-size-13" v-if="totalResults > 0">
                Mostrando {{ paginatedCategories.length }} de
                {{ totalResults }} jerarquías raíz
              </div>
            </div>

            <div
              class="border rounded overflow-hidden mb-4 bg-light bg-opacity-10"
            >
              <div v-if="loadingCategories" class="text-center py-5 bg-white">
                <div class="spinner-border text-primary m-1" role="status">
                  <span class="sr-only">Cargando...</span>
                </div>
                <p class="text-muted mt-2">
                  Cargando categorías reales desde Syscom...
                </p>
              </div>
              <ul
                class="list-unstyled mb-0"
                v-else-if="paginatedCategories.length > 0"
              >
                <CategoryItem
                  v-for="category in paginatedCategories"
                  :key="category.id"
                  :category="category"
                  :localCategories="localCategories"
                  :ancestors="[]"
                  @toggle-status="toggleCategoryStatus"
                />
              </ul>
              <div v-else class="text-center py-5 bg-white">
                <i class="bx bx-search-alt font-size-24 text-muted"></i>
                <p class="mt-2 text-muted">
                  No se encontraron categorías con los criterios actuales.
                </p>
              </div>
            </div>

            <!-- Pagination -->
            <div class="row align-items-center" v-if="totalPages > 1">
              <div class="col-sm-6">
                <div class="text-muted">
                  Página {{ currentPage }} de {{ totalPages }}
                </div>
              </div>
              <div class="col-sm-6">
                <ul
                  class="pagination pagination-rounded justify-content-end mb-0"
                >
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === 1 }"
                  >
                    <a
                      class="page-link"
                      href="javascript:void(0);"
                      @click="currentPage--"
                      aria-label="Previous"
                    >
                      <i class="bx bx-chevron-left"></i>
                    </a>
                  </li>
                  <li
                    v-for="page in totalPages"
                    :key="page"
                    class="page-item"
                    :class="{ active: currentPage === page }"
                  >
                    <a
                      class="page-link"
                      href="javascript:void(0);"
                      @click="currentPage = page"
                      >{{ page }}</a
                    >
                  </li>
                  <li
                    class="page-item"
                    :class="{ disabled: currentPage === totalPages }"
                  >
                    <a
                      class="page-link"
                      href="javascript:void(0);"
                      @click="currentPage++"
                      aria-label="Next"
                    >
                      <i class="bx bx-chevron-right"></i>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<style scoped>
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
.pagination-rounded .page-link {
  border-radius: 50%;
  margin: 0 3px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-check:checked + .btn-outline-success {
  background-color: #34c38f;
  color: #fff;
}
.btn-check:checked + .btn-outline-danger {
  background-color: #f46a6a;
  color: #fff;
}
</style>
