<script>
import Layout from "../../layouts/main";
import PageHeader from "@/components/page-header";
import localApiService from "@/services/localApi";
import Swal from "sweetalert2";
import flatPickr from "vue-flatpickr-component";
import "flatpickr/dist/flatpickr.css";
import { Spanish } from "flatpickr/dist/l10n/es.js";
import Multiselect from "@vueform/multiselect";
import "@vueform/multiselect/themes/default.css";

/**
 * Reportes component
 */
export default {
  components: {
    Layout,
    PageHeader,
    flatPickr,
    Multiselect,
  },
  data() {
    return {
      filters: {
        from: "",
        to: "",
        status: null,
        provider: "syscom",
        page: 1,
        per_page: 10,
      },
      dateRange: "",
      statusOptions: [
        { value: "SUCCESS", label: "Éxito" },
        { value: "ERROR", label: "Error" },
      ],
      providerOptions: [{ value: "syscom", label: "Syscom" }],
      reportData: [],
      summaryData: [],
      loading: false,
      exporting: false,
      totalRows: 0,
      currentPage: 1,
      perPage: 10,

      config: {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: Spanish,
      },

      // Chart Options
      chartOptions: {
        chart: {
          height: 350,
          type: "line",
          toolbar: {
            show: false,
          },
        },
        stroke: {
          width: [3, 3],
          curve: "smooth",
        },
        colors: ["#34c38f", "#f46a6a"],
        dataLabels: {
          enabled: false,
        },
        legend: {
          position: "top",
          horizontalAlign: "right",
        },
        xaxis: {
          categories: [],
          title: {
            text: "Fecha",
          },
        },
        yaxis: {
          title: {
            text: "Cantidad",
          },
        },
      },
      series: [
        {
          name: "Éxito",
          data: [],
        },
        {
          name: "Error",
          data: [],
        },
      ],
    };
  },
  computed: {
    metrics() {
      if (!this.summaryData || this.summaryData.length === 0) {
        return { total: 0, success: 0, error: 0 };
      }
      return this.summaryData.reduce(
        (acc, curr) => {
          acc.total += curr.total;
          acc.success += curr.success || 0;
          acc.error += curr.error || 0;
          return acc;
        },
        { total: 0, success: 0, error: 0 }
      );
    },
  },
  mounted() {
    // Set default dates (last 7 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const fromStr = start.toISOString().split("T")[0];
    const toStr = end.toISOString().split("T")[0];

    this.filters.from = fromStr;
    this.filters.to = toStr;

    // Set initial range for flatpickr
    this.dateRange = `${fromStr} a ${toStr}`;

    this.fetchData();
    this.fetchSummary();
  },
  methods: {
    async fetchData() {
      this.loading = true;
      try {
        const response = await localApiService.getShopifyUploadsReport({
          ...this.filters,
          page: this.currentPage,
          per_page: this.perPage,
        });

        // Handle different possible structures from the backend
        const result = response.data || response;
        if (result && (result.data || Array.isArray(result))) {
          this.reportData = Array.isArray(result.data)
            ? result.data
            : Array.isArray(result)
            ? result
            : [];
          this.totalRows = result.total || this.reportData.length;
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        this.loading = false;
      }
    },

    async fetchSummary() {
      try {
        const response = await localApiService.getShopifyUploadsReport({
          ...this.filters,
          summary: "true",
        });

        const result = response.data || response;
        if (result && Array.isArray(result)) {
          this.summaryData = result;
          this.updateChart();
        }
      } catch (error) {
        console.error("Error fetching summary data:", error);
      }
    },

    updateChart() {
      const dates = this.summaryData.map((item) => item.date);
      const successData = this.summaryData.map((item) => item.success || 0);
      const errorData = this.summaryData.map((item) => item.error || 0);

      this.chartOptions = {
        ...this.chartOptions,
        xaxis: {
          ...this.chartOptions.xaxis,
          categories: dates,
        },
      };

      this.series = [
        {
          name: "Éxito",
          data: successData,
        },
        {
          name: "Error",
          data: errorData,
        },
      ];
    },

    handleFilter() {
      this.currentPage = 1;
      this.fetchData();
      this.fetchSummary();
    },

    handlePageChange(page) {
      this.currentPage = page;
      this.fetchData();
    },

    onDateRangeChange(selectedDates) {
      if (selectedDates.length === 2) {
        // Adjust for timezone and format
        const offset = selectedDates[0].getTimezoneOffset();
        const fromDate = new Date(
          selectedDates[0].getTime() - offset * 60 * 1000
        );
        const toDate = new Date(
          selectedDates[1].getTime() - offset * 60 * 1000
        );

        this.filters.from = fromDate.toISOString().split("T")[0];
        this.filters.to = toDate.toISOString().split("T")[0];
        this.handleFilter();
      }
    },

    async exportReport() {
      this.exporting = true;
      try {
        const response = await localApiService.exportShopifyUploads(
          this.filters
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `reporte_shopify_${this.filters.from}_to_${this.filters.to}.xlsx`
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        Swal.fire({
          icon: "success",
          title: "Reporte Generado",
          text: "El archivo se ha descargado correctamente.",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Report export failed:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo generar el reporte. Por favor, intenta de nuevo.",
        });
      } finally {
        this.exporting = false;
      }
    },

    getStatusBadgeClass(status) {
      return status === "SUCCESS" ? "bg-success" : "bg-danger";
    },

    formatDate(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleString();
    },

    translateAction(action) {
      const actions = {
        CREATE: "CREAR",
        UPDATE: "ACTUALIZAR",
        DELETE: "ELIMINAR",
      };
      return actions[action] || action;
    },

    translateStatus(status) {
      const statuses = {
        SUCCESS: "ÉXITO",
        ERROR: "ERROR",
        PENDING: "PENDIENTE",
      };
      return statuses[status] || status;
    },
  },
  watch: {
    "filters.status"() {
      this.handleFilter();
    },
    "filters.provider"() {
      this.handleFilter();
    },
  },
};
</script>

<template>
  <Layout>
    <PageHeader title="Reportes de Sincronización" pageTitle="Shopify" />

    <!-- Filters -->
    <div class="row">
      <div class="col-lg-12">
        <div class="card">
          <div class="card-body">
            <h4 class="card-title mb-4">Filtros</h4>
            <div class="row align-items-end">
              <div class="col-lg-4 col-md-6 mb-3">
                <label class="form-label text-nowrap">Rango de Fecha</label>
                <flat-pickr
                  v-model="dateRange"
                  :config="config"
                  class="form-control"
                  placeholder="Seleccionar rango de fechas"
                  @on-change="onDateRangeChange"
                ></flat-pickr>
              </div>
              <div class="col-lg-3 col-md-6 mb-3">
                <label class="form-label text-nowrap">Estado</label>
                <Multiselect
                  v-model="filters.status"
                  :options="statusOptions"
                  placeholder="Todos los estados"
                  class="filters-select"
                  style="width: 100% !important"
                />
              </div>
              <div class="col-lg-3 col-md-6 mb-3">
                <label class="form-label text-nowrap">Proveedor</label>
                <Multiselect
                  v-model="filters.provider"
                  :options="providerOptions"
                  placeholder="Seleccionar"
                  class="filters-select"
                  style="width: 100% !important"
                />
              </div>
              <div class="col-lg-2 col-md-12 mb-3">
                <button class="btn btn-primary w-100" @click="handleFilter">
                  <i class="bx bx-search-alt me-1"></i> Filtrar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Metrics Cards -->
    <div class="row">
      <div class="col-md-4">
        <div class="card mini-stats-wid">
          <div class="card-body">
            <div class="d-flex">
              <div class="flex-grow-1">
                <p class="text-muted fw-medium">Total Sincronizados</p>
                <h4 class="mb-0">{{ metrics.total }}</h4>
              </div>
              <div
                class="mini-stat-icon avatar-sm rounded-circle bg-primary align-self-center"
              >
                <span class="avatar-title">
                  <i class="bx bx-copy-alt font-size-24"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card mini-stats-wid">
          <div class="card-body">
            <div class="d-flex">
              <div class="flex-grow-1">
                <p class="text-muted fw-medium">Éxitos</p>
                <h4 class="mb-0 text-success">{{ metrics.success }}</h4>
              </div>
              <div
                class="mini-stat-icon avatar-sm rounded-circle bg-success align-self-center"
              >
                <span class="avatar-title">
                  <i class="bx bx-check-circle font-size-24"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card mini-stats-wid">
          <div class="card-body">
            <div class="d-flex">
              <div class="flex-grow-1">
                <p class="text-muted fw-medium">Errores</p>
                <h4 class="mb-0 text-danger">{{ metrics.error }}</h4>
              </div>
              <div
                class="mini-stat-icon avatar-sm rounded-circle bg-danger align-self-center"
              >
                <span class="avatar-title">
                  <i class="bx bx-error-circle font-size-24"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <!-- Chart -->
      <div class="col-xl-8">
        <div class="card">
          <div class="card-body">
            <h4 class="card-title mb-4">Tendencia de Sincronización</h4>
            <div v-if="summaryData.length > 0">
              <apexchart
                class="apex-charts"
                height="350"
                type="line"
                :options="chartOptions"
                :series="series"
              ></apexchart>
            </div>
            <div v-else class="text-center py-5">
              <p class="text-muted">
                No hay datos suficientes para mostrar la gráfica.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Export Card -->
      <div class="col-xl-4">
        <div class="card bg-primary-subtle border-0">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <div class="avatar-sm me-3">
                <span
                  class="avatar-title rounded-circle bg-primary text-white font-size-18"
                >
                  <i class="bx bxs-file-export"></i>
                </span>
              </div>
              <h5 class="font-size-15 mb-0">Exportar Datos</h5>
            </div>
            <p class="text-muted">
              Descarga un archivo Excel con la información filtrada por los
              parámetros seleccionados arriba.
            </p>
            <div class="mt-4">
              <button
                class="btn btn-primary w-md"
                @click="exportReport"
                :disabled="exporting"
              >
                <i v-if="exporting" class="bx bx-loader bx-spin me-1"></i>
                <i v-else class="bx bxs-cloud-download me-1"></i>
                {{ exporting ? "Exportando..." : "Descargar Excel" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="row">
      <div class="col-lg-12">
        <div class="card">
          <div class="card-body">
            <h4 class="card-title mb-4">Detalle de Cargas</h4>
            <div class="table-responsive">
              <table class="table align-middle table-nowrap mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="align-middle">ID</th>
                    <th class="align-middle">Producto ID</th>
                    <th class="align-middle">Título del Producto</th>
                    <th class="align-middle">Acción</th>
                    <th class="align-middle">Estado</th>
                    <th class="align-middle">Fecha</th>
                    <th class="align-middle">Respuesta / Error</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loading">
                    <td colspan="7" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Cargando...</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-else-if="reportData.length === 0">
                    <td colspan="7" class="text-center py-4 text-muted">
                      No se encontraron registros coincidentes.
                    </td>
                  </tr>
                  <tr v-for="item in reportData" :key="item.id">
                    <td>#{{ item.id }}</td>
                    <td>
                      <code class="text-primary fw-bold">{{
                        item.external_id
                      }}</code>
                      <div class="text-muted font-size-10">
                        {{ item.provider }}
                      </div>
                    </td>
                    <td>
                      <div
                        class="text-truncate"
                        style="max-width: 250px"
                        :title="item.payload?.title"
                      >
                        {{ item.payload?.title || "Sin título" }}
                      </div>
                    </td>
                    <td>
                      <span
                        class="badge font-size-11"
                        :class="
                          item.action === 'CREATE'
                            ? 'badge-soft-success'
                            : 'badge-soft-info'
                        "
                      >
                        {{ translateAction(item.action) }}
                      </span>
                    </td>
                    <td>
                      <span
                        class="badge rounded-pill font-size-11"
                        :class="getStatusBadgeClass(item.status)"
                      >
                        {{ translateStatus(item.status) }}
                      </span>
                    </td>
                    <td>{{ formatDate(item.created_at) }}</td>
                    <td>
                      <div
                        class="text-truncate"
                        style="max-width: 200px"
                        :title="item.error_message || item.response"
                      >
                        <template v-if="item.status === 'SUCCESS'">
                          <span class="text-success"
                            ><i class="bx bx-check-double me-1"></i
                            >Sincronizado</span
                          >
                        </template>
                        <template v-else>
                          <span class="text-danger">{{
                            item.error_message || "Error en la carga"
                          }}</span>
                        </template>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="row mt-4">
              <div class="col-sm-12 col-md-5">
                <div class="dataTables_info">
                  Mostrando registros del
                  {{ (currentPage - 1) * perPage + 1 }} al
                  {{ Math.min(currentPage * perPage, totalRows) }} de
                  {{ totalRows }}
                </div>
              </div>
              <div class="col-sm-12 col-md-7">
                <div
                  class="dataTables_paginate paging_simple_numbers float-end"
                >
                  <b-pagination
                    v-model="currentPage"
                    :total-rows="totalRows"
                    :per-page="perPage"
                    @update:modelValue="handlePageChange"
                  ></b-pagination>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<style scoped>
.avatar-sm {
  height: 2.5rem;
  width: 2.5rem;
}
.mini-stat-icon {
  width: 48px;
  height: 48px;
  line-height: 48px;
  display: inline-block;
  text-align: center;
}

/* Match Multiselect height with Bootstrap inputs */
:deep(.filters-select) {
  min-height: 38px;
  border-radius: 0.25rem;
  border: 1px solid #ced4da;
  width: 100%;
}

:deep(.filters-select .multiselect-placeholder),
:deep(.filters-select .multiselect-single-label) {
  line-height: 38px;
  padding-left: 12px;
}

:deep(.filters-select .multiselect-caret) {
  background-color: transparent;
}
</style>
