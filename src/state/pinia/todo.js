import { defineStore } from "pinia";

export const useTodoStore = defineStore("todo", {
    state: () => ({
        todos: [],
    }),
    actions: {
        fetchTodos() {
            axios.get('https://jsonplaceholder.typicode.com/todos').then(res => {
                this.todos = res.data
            })
        },
    },

});


