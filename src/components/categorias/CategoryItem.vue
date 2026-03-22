<script>
import syscomService from "@/services/syscom";

export default {
  name: "CategoryItem",
  props: {
    category: {
      type: Object,
      required: true,
    },
    localCategories: {
      type: Array,
      default: () => [],
    },
    // Array of ancestor objects from root to parent
    ancestors: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      isOpen: false,
      loadingChildren: false,
      childrenLoaded: false,
    };
  },
  emits: ["toggle-status"],
  methods: {
    async toggle() {
      if (this.isOpen) {
        this.isOpen = false;
        return;
      }
      if (!this.childrenLoaded) {
        await this.loadSubcategories();
      }
      this.isOpen = true;
    },
    async loadSubcategories() {
      this.loadingChildren = true;
      try {
        const data = await syscomService.getCategoryDetail(this.category.id);
        if (data && data.subcategorias) {
          // eslint-disable-next-line vue/no-mutating-props
          this.category.children = data.subcategorias.map((sub) => {
            const localMatch = this.localCategories.find(
              (lc) => String(lc.provider_category_id) === String(sub.id)
            );
            return {
              id: sub.id,
              name: sub.nombre,
              active: localMatch ? Boolean(localMatch.active) : false,
              localId: localMatch ? localMatch.id : null,
              parentId: this.category.id,
              children: [],
              hasChildren: true,
              level: sub.nivel || sub.level,
            };
          });
        }
        this.childrenLoaded = true;
      } catch (error) {
        console.error("Error loading subcategories:", error);
      } finally {
        this.loadingChildren = false;
      }
    },
    onStatusChange() {
      // Emit category + its full ancestor chain so parent can handle cascades
      this.$emit("toggle-status", {
        category: this.category,
        ancestors: this.ancestors,
      });
    },
  },
};
</script>

<template>
  <li class="category-item" :class="{ 'inactive-item': !category.active }">
    <div class="d-flex align-items-center py-2 px-3 border-bottom hover-bg">
      <!-- Expand/Collapse arrow -->
      <div class="me-2" style="width: 22px; cursor: pointer" @click="toggle">
        <div
          v-if="loadingChildren"
          class="spinner-border spinner-border-sm text-primary"
          role="status"
        ></div>
        <i
          v-else
          :class="[
            'bx font-size-18 text-primary',
            isOpen ? 'bx-chevron-down' : 'bx-chevron-right',
          ]"
        ></i>
      </div>

      <!-- Name + badge -->
      <div
        class="flex-grow-1 d-flex align-items-center"
        style="cursor: pointer"
        @click="toggle"
      >
        <span class="font-size-14 fw-medium text-truncate">{{
          category.name
        }}</span>
        <span
          v-if="category.active"
          class="badge rounded-pill bg-success-subtle text-success ms-2 font-size-11"
          >Activo</span
        >
        <span
          v-else
          class="badge rounded-pill bg-danger-subtle text-danger ms-2 font-size-11"
          >Inactivo</span
        >
      </div>

      <!-- Active/Inactive switch -->
      <div class="actions d-flex align-items-center" @click.stop>
        <div class="form-check form-switch" title="Activar/Desactivar en DB">
          <input
            class="form-check-input"
            type="checkbox"
            :checked="category.active"
            @change="onStatusChange"
          />
        </div>
      </div>
    </div>

    <ul
      v-if="category.children && category.children.length > 0"
      v-show="isOpen"
      class="list-unstyled ms-4 border-start"
    >
      <CategoryItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :localCategories="localCategories"
        :ancestors="[...ancestors, category]"
        @toggle-status="$emit('toggle-status', $event)"
      />
    </ul>
    <div
      v-else-if="isOpen && !loadingChildren && childrenLoaded"
      class="ms-5 py-1 text-muted font-size-12"
    >
      No hay más subcategorías.
    </div>
  </li>
</template>

<style scoped>
.hover-bg:hover {
  background-color: rgba(0, 0, 0, 0.02);
}
.category-item {
  list-style: none;
  transition: all 0.3s ease;
}
.inactive-item > div span.fw-medium {
  color: #adb5bd;
}
.inactive-item {
  background-color: #f8f9fa;
}
.border-start {
  border-left: 1px dashed #eff2f7 !important;
}
.form-check-input {
  cursor: pointer;
}
</style>
