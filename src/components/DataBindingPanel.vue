<script setup lang="ts">
import { reactive, watch, ref } from "vue";
import * as XLSX from 'xlsx';
import type { DataBinding } from "../specs/chartSpec";

const props = defineProps<{
  binding: DataBinding;
  fields?: string[];
}>();

const emit = defineEmits<{
  (e: "update:binding", payload: DataBinding): void;
  (e: "update:encoding", payload: { category: string; value: string; series?: string }): void;
  (e: "update:years", payload: string[]): void;
  (e: "navigate:config"): void;
  (e: "preview-refresh"): void;
}>();

const local = reactive<DataBinding>({
  ...props.binding,
  query: { ...props.binding.query },
});

let syncingFromProps = false;

watch(
  () => props.binding,
  (next) => {
    syncingFromProps = true;
    Object.assign(local, next, { query: { ...next.query } });
    syncingFromProps = false;
  },
  { deep: true }
);

watch(
  () => ({ ...local, query: { ...local.query } }),
  (next, prev) => {
    if (syncingFromProps) return;
    const same = JSON.stringify(next) === JSON.stringify(prev);
    if (!same) emit("update:binding", next as DataBinding);
  },
  { deep: true }
);

const providerOptions: Array<{ label: string; value: DataBinding["provider"]; kind: DataBinding["kind"] }>
  = [
    { label: "JSON (static/HTTP)", value: "json", kind: "json" },
    { label: "HTTP API", value: "http", kind: "http" },
    { label: "Database", value: "db", kind: "db" },
  ];

const uploadStatus = ref<string | null>(null);
const mapping = reactive<{ category?: string; value?: string; series?: string }>({});

// Sync mapping with props.binding if available
watch(() => props.binding.query.source, () => {
  // If we have a source, we might want to check if preview has discovered fields
}, { immediate: true });

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploadStatus.value = "Processing...";

  try {
    let parsedRows: any[] = [];

    const name = file.name.toLowerCase();
    if (name.endsWith('.json') || file.type === 'application/json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      parsedRows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
    } else {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const first = wb.SheetNames[0];
      if (first) {
        const sheet = wb.Sheets[first];
        if (sheet) {
          parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
        }
      }
    }

    if (parsedRows.length === 0) throw new Error("File is empty or invalid format");

    const firstRow = parsedRows[0] || {};
    const keys = Object.keys(firstRow);
    
    // Create mapping guesses
    mapping.category = keys.find(k => /cat|name|label|country|region/i.test(k)) || keys[0];
    mapping.value = keys.find(k => /val|count|total|pop|population|amount|metric|score/i.test(k)) || keys[1] || keys[0];
    mapping.series = keys.find(k => /year|date|month|time|series|group/i.test(k));

    // Create a JSON blob URL
    const textJson = JSON.stringify(parsedRows);
    const blobUrl = URL.createObjectURL(new Blob([textJson], { type: "application/json" }));

    local.provider = "json";
    local.kind = "json";
    local.query.source = blobUrl;

    // Emit updates
    emit("update:encoding", { 
      category: mapping.category || '', 
      value: mapping.value || '', 
      series: mapping.series 
    });
    
    if (mapping.series) {
      const uniq = Array.from(new Set(parsedRows.map(r => String(r[mapping.series!]))).values());
      emit("update:years", uniq);
    }

    uploadStatus.value = `Success: ${parsedRows.length} rows loaded.`;
    emit("preview-refresh");
  } catch (err) {
    uploadStatus.value = "Error: Failed to parse file.";
    console.error(err);
  } finally {
    if (input) input.value = '';
  }
}

/*
function updateMapping(key: 'category' | 'value' | 'series', val: string) {
  mapping[key] = val || undefined;
  if (mapping.category && mapping.value) {
    emit("update:encoding", { 
      category: mapping.category, 
      value: mapping.value, 
      series: mapping.series 
    });
  }
}
*/
</script>

<template>
  <div class="form-grid">
    <div class="form-field form-field--wide">
      <span>Upload Data (JSON, CSV, Excel)</span>
      <div class="upload-container">
        <input type="file" accept="application/json,.csv,.tsv,.xls,.xlsx" @change="handleFileUpload" class="file-input" />
        <div v-if="uploadStatus" :class="uploadStatus.startsWith('Error') ? 'status--error' : 'status--ok'" class="status-msg">
          {{ uploadStatus }}
        </div>
      </div>
    </div>

    <!-- <div v-if="fields && fields.length" class="form-field form-field--wide" style="margin-top: 12px; border-top: 1px solid #eee; padding-top: 12px;">
      <h4 class="settings-subtitle" style="margin-bottom: 12px;">Field Mapping</h4>
      <div class="form-grid" style="grid-template-columns: 1fr; gap: 12px;">
        <label class="form-field">
          <span>Category (X-Axis)</span>
          <select :value="mapping.category" @change="updateMapping('category', ($event.target as HTMLSelectElement).value)">
            <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>Value (Y-Axis)</span>
          <select :value="mapping.value" @change="updateMapping('value', ($event.target as HTMLSelectElement).value)">
            <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>Series / Color</span>
          <select :value="mapping.series" @change="updateMapping('series', ($event.target as HTMLSelectElement).value)">
            <option value="">None</option>
            <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
      </div>
    </div> -->

    <div class="form-field">
      <span>Provider</span>
      <select
        v-model="local.provider"
        @change="local.kind = providerOptions.find(p => p.value === local.provider)?.kind ?? local.kind"
      >
        <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="form-field">
      <span>Source URL</span>
      <input type="text" v-model="local.query.source" placeholder="/api/data.json" />
    </div>
  </div>
</template>

<style scoped>
.status-msg {
  font-size: 13px;
  font-weight: 600;
}
.status--ok { color: #10b981; }
.status--error { color: #ef4444; }

.upload-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.file-input {
  font-size: 13px;
  width: 100%;
}

.settings-subtitle {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin: 0;
}
</style>
