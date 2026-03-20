import "./style.css";

import {
  ElAlert,
  ElButton,
  ElEmpty,
  ElInput,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";
import { createApp } from "vue";

import App from "./App.vue";

import "element-plus/es/components/alert/style/css";
import "element-plus/es/components/button/style/css";
import "element-plus/es/components/empty/style/css";
import "element-plus/es/components/input/style/css";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/option/style/css";
import "element-plus/es/components/select/style/css";
import "element-plus/es/components/table/style/css";
import "element-plus/es/components/table-column/style/css";
import "element-plus/es/components/tag/style/css";

const app = createApp(App);

app.component("ElAlert", ElAlert);
app.component("ElButton", ElButton);
app.component("ElEmpty", ElEmpty);
app.component("ElInput", ElInput);
app.component("ElOption", ElOption);
app.component("ElSelect", ElSelect);
app.component("ElTable", ElTable);
app.component("ElTableColumn", ElTableColumn);
app.component("ElTag", ElTag);

app.mount("#app");
