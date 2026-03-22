<script>
export default {
  name: "CategorySelectorItem",
  props: {
    category: {
      type: Object,
      required: true,
    },
    selectedCategoryId: {
      type: Number,
      default: null,
    },
  },
  data() {
    return {
      isOpen: false,
    };
  },
  emits: ["select-category"],
  methods: {
    toggle() {
      if (this.hasChildren) {
        this.isOpen = !this.isOpen;
      }
    },
    onViewClick() {
      this.$emit("select-category", this.category.id, this.category.level);
    },
  },
  computed: {
    hasChildren() {
      return this.category.children && this.category.children.length > 0;
    },
    isSelected() {
      return this.selectedCategoryId === this.category.id;
    },
  },
};
</script>

<template>
  <li class="category-selector-item">
    <div
      class="d-flex align-items-center py-2 px-3 hover-bg transition-all"
      :class="{ 'bg-primary-subtle text-primary fw-bold': isSelected }"
    >
      <!-- Toggle Expand icon -->
      <div
        @click="toggle"
        class="pointer-cursor me-1 d-flex align-items-center"
        style="width: 20px"
      >
        <i
          v-if="hasChildren"
          :class="[
            'bx font-size-18',
            isOpen ? 'bx-chevron-down' : 'bx-chevron-right',
          ]"
        ></i>
        <i v-else class="bx bx-subdirectory-right font-size-18 text-muted"></i>
      </div>

      <span class="flex-grow-1 font-size-13 text-truncate me-2">{{
        category.name
      }}</span>

      <!-- Dedicated View Button for Category -->
      <button
        class="btn btn-sm btn-soft-primary py-0 px-2 font-size-11"
        @click="onViewClick"
        :class="{ 'btn-primary text-white': isSelected }"
      >
        Ver
      </button>
    </div>

    <ul
      v-if="hasChildren"
      v-show="isOpen"
      class="list-unstyled ms-3 border-start"
    >
      <CategorySelectorItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :selectedCategoryId="selectedCategoryId"
        @select-category="(id, level) => $emit('select-category', id, level)"
      />
    </ul>
  </li>
</template>

<style scoped>
.hover-bg:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
.category-selector-item {
  list-style: none;
}
.border-start {
  border-left: 1px dashed #eff2f7 !important;
}
.pointer-cursor {
  cursor: pointer;
}
.transition-all {
  transition: all 0.2s ease;
}
</style>
