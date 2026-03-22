  import { defineStore } from "pinia";

  export const useLayoutStore = defineStore("layout", {
    state: () => ({
      layoutType: "vertical",
      leftSidebarType: "dark",
      layoutWidth: "fluid",
      topbar: "dark",
      loader: false,
      mode: "light"
    }),
    actions: {
      changeLayoutType(layoutType) {
        this.layoutType = layoutType;
      },
      changeLayoutWidth(layoutWidth) {
        this.layoutWidth = layoutWidth;
      },
      changeLeftSidebarType(leftSidebarType) {
        this.leftSidebarType = leftSidebarType;
      },
      changeTopbar(topbar) {
        this.topbar = topbar;
      },
      changeLoaderValue(loader) {
        this.loader = loader;
      },
      changeMode(mode) {
        this.mode = mode
      }
    }
  });