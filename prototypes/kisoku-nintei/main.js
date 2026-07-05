const appOptions = {
  setup() {
    const sceneSearch = ref('');
    const currentSceneId = ref('2064639102406844416');
    const currentNode = ref('scene');
    const currentProduct = ref('kisoku');

    // Try loading from localStorage first, fall back to default
    const storedForm = loadSceneFromStorage('2064639102406844416');
    let initialForm;
    try {
      initialForm = normalizeLoadedForm(storedForm) || sceneForm('2064639102406844416');
    } catch (initErr) {
      initialForm = sceneForm('2064639102406844416');
    }
    const form = reactive(initialForm);
    const savedSnapshot = ref(JSON.stringify(initialForm));

    const scenes = ref(SCENES);
    const nodes = NODES;
    const extractFields = EXTRACT_FIELDS;

    const docPickerVisible = ref(false);
    const docPickerSearch = ref('');
    const docPickerSelectedIds = ref([]);
    const docPickerMode = ref('setup');
    const sceneSetupVisible = ref(false);
    const workflowSetupStep = ref(2);
    const sceneSetupMode = ref('create');
    const sceneSetupDraft = reactive({
      sceneId: '',
      name: '新規シーン',
      description: '',
      documents: [],
      mainDocType: '',
      mainKey: '',
      docFieldLinks: [],
      aggregateRuleSettings: {},
      aggregateCompareStrategy: 'exact',
    });
    const sceneSetupAggregateDetailOpen = reactive({});
    const SCENE_AGGREGATE_COMPARE_STRATEGIES = [
      { value: 'exact', label: '完全一致' },
      { value: 'fuzzy', label: '近似一致' },
    ];

    const docTypeRegistryFiltered = computed(() => {
      const q = docPickerSearch.value.trim();
      if (!q) return DOC_TYPE_REGISTRY;
      return DOC_TYPE_REGISTRY.filter((item) => item.id.includes(q));
    });

    const docPickerAvailableCount = computed(() =>
      docTypeRegistryFiltered.value.filter((item) => !isDocTypeAdded(item.id)).length
    );

    function syncDocPickerSelection() {
      docPickerSelectedIds.value = docPickerSelectedIds.value.filter((id) => !isDocTypeAdded(id));
    }

    function onDocPickerOpened() {
      syncDocPickerSelection();
    }

    function toggleDocPickerItem(item) {
      if (isDocTypeAdded(item.id)) return;
      const ids = docPickerSelectedIds.value;
      const idx = ids.indexOf(item.id);
      if (idx >= 0) ids.splice(idx, 1);
      else ids.push(item.id);
    }

    function isDocPickerItemSelected(id) {
      return docPickerSelectedIds.value.includes(id);
    }

    watch(docPickerSearch, () => {
      if (docPickerVisible.value) syncDocPickerSelection();
    });
    const verifyActivePanels = ref(['completeness', 'text', 'data']);
    const completenessExpandedDocs = ref([]);
    const outputFieldsActivePanel = ref('');
    const exportStepFormatOptions = OUTPUT_DELIVERY_OPTIONS.map((opt) => opt.label);
    const outputSelectedDocType = ref('');
    const outputSelectedExportScope = ref('ocr');
    const outputSelectedMasterRuleId = ref('');
    const exportPreviewExpanded = reactive({});
    const exportPreviewChecked = reactive({});
    const outputDragState = reactive({
      kind: '',
      docType: '',
      fromIndex: -1,
      overIndex: -1,
    });

    const dataEditingId = ref(null);
    const dataDraft = reactive({
      input: '',
      compiled: '',
    });
    const dataPickerDocs = ref([]);
    const dataPickerField = ref('');
    const dataAiLoading = ref(false);

    const sealEditingId = ref(null);
    const sealDraft = reactive({
      docTypes: [],
      detectionTarget: '印鑑',
      threshold: 80,
    });
    const sceneSidebarCollapsed = ref(false);
    const sceneSidebarBeforeExpand = ref(null);
    const libraryPanelCollapsed = ref(false);
    const INSPECTOR_WIDTH_MIN = 320;
    const INSPECTOR_WIDTH_MAX = 720;
    const INSPECTOR_WIDTH_DEFAULT = 420;
    const INSPECTOR_WIDTH_STORAGE_KEY = 'kisoku-inspector-width-v1';
    const INSPECTOR_COLLAPSED_STORAGE_KEY = 'kisoku-inspector-collapsed-v1';

    function loadInspectorWidth() {
      try {
        const w = parseInt(localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY), 10);
        if (w >= INSPECTOR_WIDTH_MIN && w <= INSPECTOR_WIDTH_MAX) return w;
      } catch (e) { /* ignore */ }
      return INSPECTOR_WIDTH_DEFAULT;
    }

    function loadInspectorCollapsed() {
      try {
        const stored = localStorage.getItem(INSPECTOR_COLLAPSED_STORAGE_KEY);
        if (stored !== null) return stored === '1';
      } catch (e) { /* ignore */ }
      return true;
    }

    const inspectorPanelWidth = ref(loadInspectorWidth());
    const inspectorPanelCollapsed = ref(loadInspectorCollapsed());
    const inspectorResizing = ref(false);

    const inspectorWorkspaceStyle = computed(() => ({
      '--idp-inspector-width': inspectorPanelCollapsed.value
        ? '0px'
        : inspectorExpanded.value
          ? '100%'
          : `${inspectorPanelWidth.value}px`,
    }));
    const currentModule = ref('case-workflow');
    const fixedDocSettingsTarget = ref('');
    const appNavCollapsed = ref(false);
    const docSettingsMenuOpen = ref(true);
    const selectedWorkflowNodeId = ref(null);
    const selectedDataMappingRuleId = ref(null);
    const inspectorMode = ref('overview');
    const wfLibraryDrag = reactive({ type: null });
    const wfNodeDrag = reactive({ id: null, startX: 0, startY: 0, originX: 0, originY: 0 });
    const wfConnectDrag = reactive({ fromId: null, branch: null, clientX: 0, clientY: 0, active: false });
    const wfConnectHoverTargetId = ref(null);
    let wfConnectSuppressClick = false;
    const wfConnectSourceId = ref(null);
    const wfLibrarySearch = ref('');
    const wfNodePicker = reactive({
      visible: false,
      fromNodeId: null,
      toNodeId: null,
      edgeKey: null,
      edgeBranch: null,
      side: 'after',
      tab: 'nodes',
      screenX: 0,
      screenY: 0,
      hoveredLogic: null,
    });
    const REUSABLE_WORKFLOW_NODE_TYPES = new Set(['data_mapping', 'ai_verify', 'master_match']);
    const configReuseDialogVisible = ref(false);
    const configReuseDraft = reactive({
      sourceSceneId: '',
      scopes: ['step2', 'step3'],
    });
    const nodeReuseDialogVisible = ref(false);
    const nodeReuseDraft = reactive({
      type: '',
      sourceSceneId: '',
    });
    let nodeReusePendingPayload = null;
    let nodeReusePendingContext = null;
    const renamingSceneId = ref(null);
    const wfHistoryTimeline = ref([]);
    const wfHistoryIndex = ref(-1);
    const wfChangeHistoryVisible = ref(false);
    let wfHistoryRecording = true;
    const selectedWorkflowEdgeKey = ref(null);
    const hoveredWorkflowEdgeKey = ref(null);
    const wfCanvasViewportRef = ref(null);
    const wfViewport = reactive({ x: 0, y: 0, scale: 1 });
    const wfCanvasMaximized = ref(false);
    const wfCanvasNodesCollapsed = ref(false);
    const wfPanDrag = reactive({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

    function getFlowNodeKey() {
      return 'case';
    }

    function getActiveWf() {
      ensureFormWorkflows(form);
      return form.workflows.case;
    }

    const activeWorkflow = computed(() => getActiveWf());

    const isCaseWorkflowModule = computed(() => true);

    const modulePageMeta = computed(() => MODULE_PAGE_META[currentModule.value] || MODULE_PAGE_META['case-workflow']);
    const wfTemplateHintVisible = ref(false);
    let wfTemplateHintTimer = null;
    const isWorkflowTopologyEditable = computed(() => true);

    function flashWorkflowTemplateHint() {
      if (wfTemplateHintTimer) clearTimeout(wfTemplateHintTimer);
      wfTemplateHintVisible.value = false;
      if (!isDefaultCaseWorkflowTemplate(getActiveWf())) return;
      wfTemplateHintVisible.value = true;
      wfTemplateHintTimer = setTimeout(() => {
        wfTemplateHintVisible.value = false;
      }, 3200);
    }

    watch(currentSceneId, () => {
      nextTick(flashWorkflowTemplateHint);
    });

    watch(
      () => (form.scene.documents || []).map((d) => d.type),
      (types) => {
        const known = new Set(completenessExpandedDocs.value);
        completenessExpandedDocs.value = types.filter((t) => known.has(t)).length
          ? types.filter((t) => known.has(t))
          : [...types];
      },
      { immediate: true },
    );

    const inspectorExpanded = ref(false);

    function assertWorkflowTopologyEditable() {
      return true;
    }

    const processingForm = computed(() => form.processing);

    const inspectorExpandable = computed(() => (
      inspectorPanel.value === 'data_mapping'
      || inspectorPanel.value === 'ai_verify'
      || inspectorPanel.value === 'master_match'
    ));

    function switchModule(moduleId) {
      const navItem = APP_NAV_GROUPS.flatMap((g) => (g.children ? g.children : [g]))
        .find((item) => item.id === moduleId);
      if (navItem?.placeholder) {
        ElementPlus.ElMessage.info('この機能は準備中です');
        return;
      }
      if (!MODULE_PAGE_META[moduleId]) return;
      if (currentModule.value === moduleId) return;
      inspectorExpanded.value = false;
      restoreSceneSidebarAfterEditor();
      currentModule.value = moduleId;
      if (moduleId === 'mcp-servers') return;
      if (moduleId !== 'case-workflow') return;
      selectedWorkflowEdgeKey.value = null;
      inspectorMode.value = 'node';
      selectedWorkflowNodeId.value = null;
      inspectorPanelCollapsed.value = true;
      syncCurrentNodeFromWorkflow(null);
      initWorkflowHistory('案件フローを読み込み');
      nextTick(() => fitWorkflowToView());
    }

    function getPrimaryDataMappingNode(wf) {
      return (wf?.nodes || []).find((n) => n.type === 'data_mapping') || null;
    }

    function getPrimaryMasterMatchNode(wf) {
      return (wf?.nodes || []).find((n) => n.type === 'master_match') || null;
    }

    const primaryDataMappingNode = computed(() => getPrimaryDataMappingNode(getActiveWf()));
    const primaryMasterMatchNode = computed(() => getPrimaryMasterMatchNode(getActiveWf()));

    function getActiveDataMappingNode() {
      const node = selectedWorkflowNode.value;
      if (node?.type === 'data_mapping') return node;
      return primaryDataMappingNode.value;
    }

    function expandInspectorEditor() {
      if (!inspectorExpandable.value) return;
      inspectorPanelCollapsed.value = false;
      sceneSidebarBeforeExpand.value = sceneSidebarCollapsed.value;
      sceneSidebarCollapsed.value = true;
      inspectorExpanded.value = true;
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, '0');
      } catch (e) { /* ignore */ }
      nextTick(() => {
        ensureDataMappingEditorReady();
        ensureMasterMatchEditorReady();
      });
    }

    function collapseInspectorEditor() {
      inspectorExpanded.value = false;
      resetMasterMatchRuleDraft();
      if (sceneSidebarBeforeExpand.value !== null) {
        sceneSidebarCollapsed.value = sceneSidebarBeforeExpand.value;
        sceneSidebarBeforeExpand.value = null;
      }
    }

    function restoreSceneSidebarAfterEditor() {
      if (sceneSidebarBeforeExpand.value !== null) {
        sceneSidebarCollapsed.value = sceneSidebarBeforeExpand.value;
        sceneSidebarBeforeExpand.value = null;
      }
    }

    function formatDataMappingRuleSourceSummary(rule) {
      const ids = rule.sourceFieldIds || [];
      if (!ids.length) return '—';
      const labels = ids.slice(0, 2).map((id) => {
        const opt = dataMappingSourceFieldOptions.value.find((o) => o.value === id);
        return opt?.label || id;
      });
      const suffix = ids.length > 2 ? ` +${ids.length - 2}` : '';
      return `${labels.join(' · ')}${suffix}`;
    }

    function openFixedDocSettings(typeId) {
      if (typeId) fixedDocSettingsTarget.value = typeId;
      docSettingsMenuOpen.value = true;
      switchModule('fixed-doc');
    }

    function toggleDocSettingsMenu() {
      docSettingsMenuOpen.value = !docSettingsMenuOpen.value;
    }

    const textEditingId = ref(null);
    const textDraft = reactive({
      input: '',
      compiled: '',
    });
    const textPickerDocs = ref([]);
    const textPickerField = ref('');
    const textAiLoading = ref(false);
    const textPreviewFlash = ref(false);
    let textDraftSyncing = false;
    let dataDraftSyncing = false;
    const dataPreviewFlash = ref(false);

    const SEAL_FIELD_SUGGESTIONS = ['氏名', '日付', '医療機関名', '代表者印', '会社名', '担当者印', '医師印', '病院長印'];

    const filteredScenes = computed(() => {
      const q = sceneSearch.value.trim();
      return q ? scenes.value.filter((s) => s.name.includes(q)) : scenes.value;
    });

    function snapshotWorkflowState() {
      return cloneJson(getActiveWf() || { nodes: [], edges: [] });
    }

    function initWorkflowHistory(label = '初期状態') {
      wfHistoryTimeline.value = [{
        id: String(Date.now()),
        label,
        time: formatWorkflowHistoryTime(),
        workflow: snapshotWorkflowState(),
      }];
      wfHistoryIndex.value = 0;
    }

    function restoreWorkflowSnapshot(snapshot) {
      wfHistoryRecording = false;
      const normalized = normalizeWorkflow(cloneJson(snapshot));
      getActiveWf().nodes = normalized.nodes;
      getActiveWf().edges = normalized.edges;
      if (selectedWorkflowNodeId.value && !getActiveWf().nodes.some((n) => n.id === selectedWorkflowNodeId.value)) {
        selectedWorkflowNodeId.value = getActiveWf().nodes[0]?.id || null;
      }
      wfHistoryRecording = true;
    }

    function pushWorkflowHistory(label) {
      if (!wfHistoryRecording || !getActiveWf()) return;
      const trimmed = wfHistoryTimeline.value.slice(0, wfHistoryIndex.value + 1);
      trimmed.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        time: formatWorkflowHistoryTime(),
        workflow: snapshotWorkflowState(),
      });
      if (trimmed.length > 50) trimmed.shift();
      wfHistoryTimeline.value = trimmed;
      wfHistoryIndex.value = trimmed.length - 1;
    }

    function undoWorkflow() {
      if (wfHistoryIndex.value <= 0) return;
      wfHistoryIndex.value -= 1;
      restoreWorkflowSnapshot(wfHistoryTimeline.value[wfHistoryIndex.value].workflow);
      ElementPlus.ElMessage.info('元に戻しました');
    }

    function redoWorkflow() {
      if (wfHistoryIndex.value >= wfHistoryTimeline.value.length - 1) return;
      wfHistoryIndex.value += 1;
      restoreWorkflowSnapshot(wfHistoryTimeline.value[wfHistoryIndex.value].workflow);
      ElementPlus.ElMessage.info('やり直しました');
    }

    function restoreWorkflowHistoryEntry(index) {
      if (index < 0 || index >= wfHistoryTimeline.value.length) return;
      wfHistoryIndex.value = index;
      restoreWorkflowSnapshot(wfHistoryTimeline.value[index].workflow);
      wfChangeHistoryVisible.value = false;
      ElementPlus.ElMessage.success('履歴の状態に復元しました');
    }

    function swapSelectedWorkflowNode(direction) {
      const id = selectedWorkflowNodeId.value;
      if (!id || !getActiveWf()) return;
      const chain = getWorkflowMainChainIds(getActiveWf());
      const idx = chain.indexOf(id);
      if (idx < 0) return;
      const otherIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (otherIdx < 0 || otherIdx >= chain.length) return;
      const firstId = chain[Math.min(idx, otherIdx)];
      const secondId = chain[Math.max(idx, otherIdx)];
      const nodeA = getActiveWf().nodes.find((n) => n.id === firstId);
      const nodeB = getActiveWf().nodes.find((n) => n.id === secondId);
      if (!nodeA || !nodeB) return;
      const tx = nodeA.x;
      const ty = nodeA.y;
      nodeA.x = nodeB.x;
      nodeA.y = nodeB.y;
      nodeB.x = tx;
      nodeB.y = ty;
      if (!swapAdjacentMainChainEdges(getActiveWf(), firstId, secondId)) {
        nodeB.x = nodeA.x;
        nodeB.y = nodeA.y;
        nodeA.x = tx;
        nodeA.y = ty;
        ElementPlus.ElMessage.warning('メインフロー上の隣接ノードのみ入れ替えできます');
        return;
      }
      pushWorkflowHistory('ノード位置を入れ替え');
      ElementPlus.ElMessage.success('ノード位置を入れ替えました');
    }

    const canUndoWorkflow = computed(() => wfHistoryIndex.value > 0);
    const canRedoWorkflow = computed(() => wfHistoryIndex.value < wfHistoryTimeline.value.length - 1);
    const workflowHistoryEntries = computed(() =>
      [...wfHistoryTimeline.value].reverse().map((entry, reverseIdx) => ({
        ...entry,
        index: wfHistoryTimeline.value.length - 1 - reverseIdx,
      })));
    const canSwapWorkflowNodeLeft = computed(() => {
      const id = selectedWorkflowNodeId.value;
      if (!id) return false;
      const chain = getWorkflowMainChainIds(getActiveWf());
      const idx = chain.indexOf(id);
      return idx > 0;
    });
    const canSwapWorkflowNodeRight = computed(() => {
      const id = selectedWorkflowNodeId.value;
      if (!id) return false;
      const chain = getWorkflowMainChainIds(getActiveWf());
      const idx = chain.indexOf(id);
      return idx >= 0 && idx < chain.length - 1;
    });

    const treeProps = { children: 'children', label: 'label' };

    const currentScene = computed(() =>
      scenes.value.find((s) => s.id === currentSceneId.value) || scenes.value[0]
    );
    const sceneArchiveTree = computed(() => {
      const sceneName = (form.scene.name || currentScene.value?.name || '未命名シーン').trim();
      const docs = form.scene.documents || [];
      const docNodes = docs.map((doc, idx) => ({
        id: `doc-${idx}`,
        label: `${getDocDisplayLabel(doc.type)}（${doc.submission}）`,
      }));
      return [
        {
          id: 'scene-root',
          label: sceneName,
          children: [
            { id: 'scene-inbox', label: '入力ファイル', children: docNodes.length ? docNodes : [{ id: 'scene-empty', label: '帳票未設定' }] },
            { id: 'scene-rule', label: '案件Workflow設定', children: [
              { id: 'scene-match', label: 'マスタ照合（Workflow）' },
              { id: 'scene-text', label: `テキスト検証 ${form.verify.text.length} 件` },
              { id: 'scene-data', label: `データ検証 ${form.verify.dataRules.length} 件` },
            ] },
            { id: 'scene-output', label: `出力設定（${form.output.deliveryMethod === 'shared_folder' ? '共有フォルダ' : 'API'}）` },
          ],
        },
      ];
    });

    const nodeIndex = computed(() => NODE_ORDER.indexOf(currentNode.value));
    const isFirstNode = computed(() => nodeIndex.value === 0);
    const isLastNode = computed(() => nodeIndex.value === NODE_ORDER.length - 1);
    const saveButtonText = computed(() => (isLastNode.value ? '設定を完了' : '保存'));

    const sceneStats = computed(() => {
      const docs = form.scene.documents;
      return {
        total: docs.length,
        required: docs.filter((d) => d.submission === '必須').length,
        optional: docs.filter((d) => d.submission === '任意' || d.submission === '代替可').length,
        requiredFields: docs.reduce((sum, doc) => sum + getDocRequiredFieldCount(doc), 0),
      };
    });

    const outputFieldCount = computed(() => {
      let count = 0;
      (form.output.docFields || []).forEach((doc) => {
        count += (doc.fields || []).filter((f) => f.checked).length;
        (doc.dictFields || []).forEach((df) => {
          if (df.exportCodeChecked) count += 1;
          if (df.exportNameChecked) count += 1;
        });
      });
      return count;
    });
    const outputTableStats = computed(() => {
      let tables = 0;
      let columns = 0;
      (form.output.docFields || []).forEach((doc) => {
        (doc.tables || []).forEach((table) => {
          const checkedCols = (table.columns || []).filter((c) => c.checked).length;
          if (checkedCols) {
            tables += 1;
            columns += checkedCols;
          }
        });
      });
      return { tables, columns };
    });

    const activeOutputDocFields = computed(() => {
      const docs = form.output.docFields || [];
      if (!docs.length) return null;
      return docs.find((d) => d.docType === outputSelectedDocType.value) || docs[0];
    });

    const activeOutputExportRowsBase = computed(() => buildExportStandardFieldRows(
      outputSelectedDocType.value,
      primaryDataMappingNode.value,
      form.output.exportStandardFieldIds,
    ));

    const activeOutputExportRows = computed(() => {
      const rows = activeOutputExportRowsBase.value;
      const docType = outputSelectedDocType.value;
      const order = form.output.exportStandardFieldOrderByDoc?.[docType];
      if (!order?.length) return rows;
      const rank = Object.fromEntries(order.map((id, index) => [id, index]));
      return [...rows].sort((a, b) =>
        (rank[a.standardFieldId] ?? 9999) - (rank[b.standardFieldId] ?? 9999));
    });

    const exportDeliveryMethodLabel = computed(() =>
      (OUTPUT_DELIVERY_OPTIONS.find((opt) => opt.value === form.output.deliveryMethod) || OUTPUT_DELIVERY_OPTIONS[0]).label,
    );

    const exportNamingPreviewText = computed(() => {
      const naming = syncOutputNamingPatterns(form.output.naming || OUTPUT_NAMING_DEFAULTS);
      const ctx = {
        sceneName: form.scene.name || currentScene.value?.name,
        docType: getDocDisplayLabel(outputSelectedDocType.value || form.scene.documents?.[0]?.type || '診断書'),
        serialNo: String(1).padStart(naming.serialDigits || 6, '0'),
      };
      return resolveNamingPattern(naming.docFilePattern || buildStructuredNamingPattern(naming), ctx);
    });

    const masterMatchExportRows = computed(() =>
      buildMasterMatchExportRows(
        primaryMasterMatchNode.value?.matchRules || [],
        form.output.masterMatchExports,
      ),
    );

    const activeMasterMatchExportRows = computed(() => {
      const rows = masterMatchExportRows.value;
      if (!outputSelectedMasterRuleId.value) return rows;
      return rows.filter((row) => row.ruleId === outputSelectedMasterRuleId.value);
    });

    const exportPreprocessedFileRows = computed(() => {
      const docs = form.output.docFields || [];
      return docs.flatMap((doc) =>
        buildExportPreviewFiles(doc.docType).map((file) => ({
          ...file,
          docLabel: getDocExportLabel(doc.docType),
        })));
    });

    const exportPreviewRoot = computed(() =>
      buildExportPreviewTree(
        form.output.docFields || [],
        primaryMasterMatchNode.value?.matchRules || [],
      )
    );

    function syncMasterMatchExportSettings() {
      const next = syncMasterMatchExportConfig(
        form.output.masterMatchExports,
        primaryMasterMatchNode.value?.matchRules || [],
      );
      const prevJson = JSON.stringify(form.output.masterMatchExports || []);
      const nextJson = JSON.stringify(next);
      if (prevJson !== nextJson) {
        form.output.masterMatchExports = next;
      }
    }

    let lastNamingWatchKey = '';
    function getNamingWatchKey() {
      return [
        form.output.naming?.prefixMode,
        form.output.naming?.prefixCustom,
        form.output.naming?.serialDigits,
        form.output.naming?.includeDate,
        form.output.naming?.dateFormat,
        form.output.naming?.separator,
      ].join('\u0001');
    }

    function applyOutputNamingPatterns() {
      const key = getNamingWatchKey();
      if (key === lastNamingWatchKey) return;
      lastNamingWatchKey = key;
      const next = syncOutputNamingPatterns(form.output.naming || OUTPUT_NAMING_DEFAULTS);
      if (!form.output.naming || typeof form.output.naming !== 'object') {
        form.output.naming = next;
      } else {
        const naming = form.output.naming;
        ['docFilePattern', 'caseFilePattern', 'apiPayloadName'].forEach((field) => {
          if (naming[field] !== next[field]) naming[field] = next[field];
        });
      }
      if (form.output.fileNamePattern !== next.docFilePattern) {
        form.output.fileNamePattern = next.docFilePattern;
      }
    }

    applyOutputNamingPatterns();

    watch(
      () => (primaryMasterMatchNode.value?.matchRules || []).map((rule) => rule.id).join('\u0001'),
      () => syncMasterMatchExportSettings(),
      { immediate: true },
    );

    watch(
      exportPreviewRoot,
      (tree) => {
        collectExportPreviewNodes(tree).forEach((node) => {
          if (exportPreviewChecked[node.id] === undefined) exportPreviewChecked[node.id] = true;
          if (exportPreviewExpanded[node.id] === undefined) exportPreviewExpanded[node.id] = true;
        });
      },
      { immediate: true, deep: true }
    );

    const exportPreviewRows = computed(() =>
      flattenExportPreviewTree(exportPreviewRoot.value, exportPreviewExpanded)
    );

    const exportPreviewSelectAllState = computed(() => {
      const nodes = collectExportPreviewNodes(exportPreviewRoot.value);
      if (!nodes.length) return { checked: false, indeterminate: false };
      const checkedCount = nodes.filter((node) => exportPreviewChecked[node.id]).length;
      return {
        checked: checkedCount === nodes.length,
        indeterminate: checkedCount > 0 && checkedCount < nodes.length,
      };
    });

    watch(
      () => (form.output.docFields || []).map((d) => d.docType).join('\u0001'),
      () => {
        const docs = form.output.docFields || [];
        if (!docs.length) {
          outputSelectedDocType.value = '';
          return;
        }
        if (!docs.some((d) => d.docType === outputSelectedDocType.value)) {
          outputSelectedDocType.value = docs[0].docType;
        }
      },
      { immediate: true }
    );
    const sceneSetupPageTitle = '業務シーン・案件集約';
    const sceneSetupSceneIdDisplay = computed(() =>
      (sceneSetupDraft.sceneId ? sceneSetupDraft.sceneId : '保存後に自動採番されます'));
    const sceneSetupConfirmLabel = computed(() =>
      (sceneSetupMode.value === 'edit' ? '保存して次へ' : '作成して次へ'));
    const sceneSetupDocTypeOptions = computed(() =>
      sceneSetupDraft.documents.map((d) => ({
        value: d.type,
        label: getDocDisplayLabel(d.type),
      })));
    const sceneSetupLinkCheckVisible = ref(false);
    let sceneSetupLinkCheckTimer = null;
    const SCENE_LINK_CHECK_DISPLAY_MS = 3500;

    function clearSceneSetupLinkCheckDisplay() {
      if (sceneSetupLinkCheckTimer) {
        clearTimeout(sceneSetupLinkCheckTimer);
        sceneSetupLinkCheckTimer = null;
      }
      sceneSetupLinkCheckVisible.value = false;
    }

    function flashSceneSetupLinkCheckResult() {
      clearSceneSetupLinkCheckDisplay();
      sceneSetupLinkCheckVisible.value = true;
      sceneSetupLinkCheckTimer = setTimeout(clearSceneSetupLinkCheckDisplay, SCENE_LINK_CHECK_DISPLAY_MS);
    }

    const sceneSetupLinkStats = computed(() =>
      computeSceneLinkStats(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        sceneSetupDraft.docFieldLinks,
      )
    );
    const sceneSetupUnlinkedDocLabels = computed(() =>
      sceneSetupLinkStats.value.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、')
    );
    const sceneSetupLinkCheckSummary = computed(() => {
      const stats = sceneSetupLinkStats.value;
      if (stats.unlinkedCount > 0) {
        const names = stats.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、');
        return { tone: 'warn', text: `${stats.unlinkedCount} 件が主帳票に未関連：${names}` };
      }
      if (stats.total <= stats.mainDocCount) {
        return { tone: 'ok', text: '主帳票のみの構成です' };
      }
      return { tone: 'ok', text: `${stats.linkedCount} 件の帳票が主帳票に関連付け済み` };
    });
    const sceneSetupNetworkLayout = computed(() =>
      buildSceneSetupNetworkLayout(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType,
        sceneSetupDraft.docFieldLinks,
        getDocDisplayLabel,
        (docType) => getDocSchema(docType).fields || [],
        sceneSetupDraft.mainKey,
      )
    );
    const sceneSetupAggregateRuleGroups = computed(() => {
      const mainDocType = sceneSetupDraft.mainDocType;
      if (!mainDocType) return [];
      return (sceneSetupDraft.documents || [])
        .filter((doc) => doc.type !== mainDocType)
        .map((doc) => {
          const links = (sceneSetupDraft.docFieldLinks || []).filter((link) =>
            isSceneSetupLinkBetweenMainAndDoc(link, doc.type)
          );
          return {
            docType: doc.type,
            label: getDocDisplayLabel(doc.type),
            links,
            status: !links.length ? 'missing' : 'configured',
          };
        });
    });
    const sceneSetupAggregateInvalidGroups = computed(() =>
      sceneSetupAggregateRuleGroups.value.filter((group) =>
        group.status === 'missing'
      )
    );
    const sceneSetupMainKeyOptions = computed(() =>
      sceneSetupDraft.mainDocType ? getSceneSetupFieldOptions(sceneSetupDraft.mainDocType) : []
    );

    const selectedHitlRoleHint = computed(() =>
      HITL_ROLE_OPTIONS.find((item) => item.value === processingForm.value?.hitl?.role)?.hint || '復核ロールを選択してください'
    );

    const selectedHitlGateRoleHint = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return '復核ロールを選択してください';
      return HITL_ROLE_OPTIONS.find((item) => item.value === node.role)?.hint || '復核ロールを選択してください';
    });

    function onHitlGateContextChange(contextValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return;
      const meta = getHitlContextMeta(contextValue);
      if (!meta) return;
      node.hitlContext = meta.value;
      node.label = '人工確認';
      node.role = getHitlGateDefaultRole(meta.value);
      pushWorkflowHistory('人工確認コンテキストを変更');
    }

    function isHitlActionSelected(actionValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return false;
      return normalizeHitlGateActions(node.actions).includes(actionValue);
    }

    function toggleHitlAction(actionValue) {
      const node = selectedWorkflowNode.value;
      if (!node || !isHitlGateNode(node)) return;
      const current = normalizeHitlGateActions(node.actions);
      if (current.includes(actionValue)) {
        if (current.length <= 1) return;
        node.actions = current.filter((a) => a !== actionValue);
      } else {
        node.actions = [...current, actionValue];
      }
      pushWorkflowHistory('処理アクションを変更');
    }

    function applyJudgmentContextToNode(node, contextValue, force = false) {
      const wf = getActiveWf();
      const meta = JUDGMENT_CONTEXT_OPTIONS.find((o) => o.value === contextValue) || JUDGMENT_CONTEXT_OPTIONS[0];
      node.judgmentContext = meta.value;
      node.conditionType = meta.value;
      node.label = meta.label;
      node.elseLabel = JUDGMENT_ELSE_LABELS[meta.value] || 'ELSE';
      node.elseDescription = node.elseLabel;
      if (meta.value !== 'custom' || force) {
        node.cases = buildDecisionCasesFromPreset(meta.value, wf, node.id, form.verify);
      }
      if (wf) sanitizeDecisionEdges(wf);
    }

    function onJudgmentContextChange(contextValue) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      const prev = node.judgmentContext || inferJudgmentContext(node);
      if (prev === contextValue) return;
      const apply = () => {
        applyJudgmentContextToNode(node, contextValue, true);
        pushWorkflowHistory('判断コンテキストを変更');
      };
      if (prev === 'custom' || contextValue === 'custom') {
        apply();
        return;
      }
      ElementPlus.ElMessageBox.confirm(
        '判断コンテキストを変更すると、IF/ELIF 条件がプリセット既定で上書きされます。続行しますか？',
        '条件の上書き',
        { confirmButtonText: '上書きする', cancelButtonText: 'キャンセル', type: 'warning' },
      ).then(apply).catch(() => {});
    }

    function onDecisionElseLabelChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      node.elseDescription = node.elseLabel || '';
      const wf = getActiveWf();
      if (wf) sanitizeDecisionEdges(wf);
      pushWorkflowHistory('ELSE ラベルを変更');
    }

    function onNotifyTemplateChange(templateValue) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'notify') return;
      const prevTemplate = migrateNotifyTemplate(node.template);
      if (prevTemplate === templateValue) return;
      const apply = () => {
        const defaults = getNotifyTemplateDefaults(templateValue);
        node.template = templateValue;
        node.subject = defaults.subject;
        node.body = defaults.body;
        node.supplementEventEnabled = templateValue === 'deficiency';
        pushWorkflowHistory('通知プリセットを変更');
      };
      const prevDefaults = getNotifyTemplateDefaults(prevTemplate);
      const hasCustom = (node.subject && node.subject !== prevDefaults.subject)
        || (node.body && node.body !== prevDefaults.body);
      if (!hasCustom) {
        apply();
        return;
      }
      ElementPlus.ElMessageBox.confirm(
        'プリセットを変更すると、件名・本文が既定テンプレートで上書きされます。続行しますか？',
        '通知内容の上書き',
        { confirmButtonText: '上書きする', cancelButtonText: 'キャンセル', type: 'warning' },
      ).then(apply).catch(() => {});
    }

    function onNotifyRecipientsBlur() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'notify') return;
      const result = validateNotifyRecipients(node.channel, node.recipients);
      if (!result.ok && result.message) {
        ElementPlus.ElMessage.warning(result.message);
      }
    }

    function onEndNamingChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'end') return;
      Object.assign(node, normalizeEndNode(node));
      pushWorkflowHistory('終了ノードの命名規則を変更');
    }

    function insertEndNamingToken(token) {
      const node = selectedWorkflowNode.value;
      if (!node?.namingConfig) return;
      node.namingConfig.pattern = `${node.namingConfig.pattern || ''}${token}`;
      onEndNamingChange();
    }

    const codeVariableOptions = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'code') return [];
      return buildCodeVariableOptions(getActiveWf(), node.id, form.verify);
    });

    const codeVariableOptionGroups = computed(() =>
      getDecisionVariableOptionGroups(codeVariableOptions.value));

    const codeParamDialogVisible = ref(false);
    const codeParamDialogMode = ref('input');
    const codeParamDialogDraft = ref(createCodeParamDialogDraft('input'));

    const codeParamDialogTitle = computed(() => {
      const editing = !!codeParamDialogDraft.value?.id;
      return editing ? 'パラメータを編集' : 'パラメータを追加';
    });

    const codeParamDialogConfirmLabel = computed(() =>
      (codeParamDialogDraft.value?.id ? '保存' : '追加'));

    const codeParamDialogSavable = computed(() => {
      const draft = codeParamDialogDraft.value;
      if (!draft?.name?.trim()) return false;
      if (draft.source === 'reference') return !!draft.variable;
      return !!(draft.customValue || '').trim();
    });

    function openCodeParamDialog(mode = 'input', row = null) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'code') return;
      codeParamDialogMode.value = 'input';
      if (row) {
        codeParamDialogDraft.value = {
          id: row.id,
          name: row.name,
          dataType: row.dataType || 'string',
          source: row.source || 'reference',
          required: row.required !== false,
          variable: row.variable || '',
          customValue: row.customValue || '',
        };
      } else {
        const draft = createCodeParamDialogDraft('input');
        const count = (node.inputs || []).length;
        draft.name = `input_${count + 1}`;
        codeParamDialogDraft.value = draft;
      }
      codeParamDialogVisible.value = true;
    }

    function closeCodeParamDialog() {
      codeParamDialogVisible.value = false;
    }

    function confirmCodeParamDialog() {
      const node = selectedWorkflowNode.value;
      const draft = codeParamDialogDraft.value;
      if (!node || node.type !== 'code' || !codeParamDialogSavable.value) return;
      if (!Array.isArray(node.inputs)) node.inputs = [];
      const payload = normalizeCodeInputRow({
        id: draft.id || newRuleId('cin'),
        name: draft.name.trim(),
        dataType: draft.dataType,
        source: draft.source,
        required: draft.required,
        variable: draft.source === 'reference' ? draft.variable : '',
        customValue: draft.source === 'custom' ? draft.customValue : '',
      }, node.inputs.length);
      const idx = node.inputs.findIndex((r) => r.id === draft.id);
      if (idx >= 0) node.inputs[idx] = payload;
      else node.inputs.push(payload);
      pushWorkflowHistory(draft.id ? '入参を更新' : '入参を追加');
      codeParamDialogVisible.value = false;
    }

    function addCodeInputRow() {
      openCodeParamDialog('input');
    }

    function removeCodeInputRow(rowId) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'code' || !node.inputs?.length) return;
      node.inputs = node.inputs.filter((r) => r.id !== rowId);
      pushWorkflowHistory('入参を削除');
    }

    function onCodeFieldChange() {
      pushWorkflowHistory('カスタム関数を変更');
    }

    const workflowConditionAiLoading = ref(false);
    const workflowConditionPreviewFlash = ref(false);

    function aiAssistWorkflowCondition() {
      const node = selectedWorkflowNode.value;
      if (!node || (node.type !== 'decision' && !isHitlGateNode(node))) return;
      const rule = (node.yesRule || '').trim();
      if (!rule) {
        ElementPlus.ElMessage.warning('条件を入力してください');
        return;
      }
      workflowConditionAiLoading.value = true;
      setTimeout(() => {
        const compiled = compileWorkflowYesExpression(rule, node.conditionType, sceneDocTypes.value, node);
        const isPresetFallback = !compileNaturalToExpression(rule, sceneDocTypes.value)
          && !/\{\{[^}]+\}\}/.test(rule)
          && compiled === (DECISION_PRESET_EXPRESSION[node.conditionType] || '');
        if (!compiled || compiled === rule) {
          ElementPlus.ElMessage.warning('実行式に変換できませんでした。帳票名・フィールド・判定基準を明確に記述してください');
          workflowConditionAiLoading.value = false;
          return;
        }
        node.yesExpression = compiled;
        syncDecisionYesRuleToCases(node);
        workflowConditionPreviewFlash.value = true;
        setTimeout(() => { workflowConditionPreviewFlash.value = false; }, 1600);
        workflowConditionAiLoading.value = false;
        pushWorkflowHistory('AI 補助で実行式を生成');
        ElementPlus.ElMessage.success(isPresetFallback ? 'プリセット既定の実行式を適用しました' : '実行式を生成しました');
      }, 400);
    }

    function ensureOcrExtractConfig() {
      const pf = processingForm.value;
      if (!pf.ocrExtract) {
        pf.ocrExtract = cloneJson(WORKFLOW_DEFAULTS.ocrExtract);
        return;
      }
      if (!Array.isArray(pf.ocrExtract.enabledTypes)) pf.ocrExtract.enabledTypes = [];
      if (!pf.ocrExtract.mergeByType || typeof pf.ocrExtract.mergeByType !== 'object') {
        pf.ocrExtract.mergeByType = {};
      }
      if (typeof pf.ocrExtract.mergeSameType !== 'boolean') pf.ocrExtract.mergeSameType = false;
      if (pf.ocrExtract.confidenceThreshold == null) pf.ocrExtract.confidenceThreshold = WORKFLOW_DEFAULTS.ocrExtract.confidenceThreshold;
      if (typeof pf.ocrExtract.llmOcrEnabled !== 'boolean') pf.ocrExtract.llmOcrEnabled = WORKFLOW_DEFAULTS.ocrExtract.llmOcrEnabled;
    }

    function isOcrExtractEnabled(typeId) {
      ensureOcrExtractConfig();
      const pf = processingForm.value;
      const types = form.scene.documents.map((d) => d.type);
      if (!types.includes(typeId)) return false;
      const enabled = pf.ocrExtract.enabledTypes;
      if (!enabled.length) return true;
      return enabled.includes(typeId);
    }

    function toggleOcrExtract(typeId, enabled) {
      ensureOcrExtractConfig();
      const pf = processingForm.value;
      const allTypes = form.scene.documents.map((d) => d.type);
      let enabledTypes = [...pf.ocrExtract.enabledTypes];
      if (!enabledTypes.length) enabledTypes = [...allTypes];
      if (enabled) {
        if (!enabledTypes.includes(typeId)) enabledTypes.push(typeId);
      } else {
        enabledTypes = enabledTypes.filter((t) => t !== typeId);
      }
      pf.ocrExtract.enabledTypes = enabledTypes;
    }

    function getOcrMergeSameType(typeId) {
      ensureOcrExtractConfig();
      const byType = processingForm.value.ocrExtract.mergeByType || {};
      if (Object.prototype.hasOwnProperty.call(byType, typeId)) return !!byType[typeId];
      return !!processingForm.value.ocrExtract.mergeSameType;
    }

    function setOcrMergeSameType(typeId, mergeSameType) {
      ensureOcrExtractConfig();
      const pf = processingForm.value;
      if (!pf.ocrExtract.mergeByType) pf.ocrExtract.mergeByType = {};
      pf.ocrExtract.mergeByType[typeId] = !!mergeSameType;
    }

    function getOcrTemplateStatus(docType) {
      const schema = getDocSchema(docType);
      const fields = schema?.fields || [];
      if (!fields.length) return 'warn';
      const label = getDocDisplayLabel(docType);
      if (label.includes('診断書') && !label.includes('入院')) return 'warn';
      return 'ok';
    }

    function syncOcrExtractTypes() {
      syncOcrExtractTypesOnForm(form);
    }

    const ocrExtractItems = computed(() => {
      const mainDocType = getSceneMainDocType(form.scene);
      return form.scene.documents.map((d) => ({
        type: d.type,
        isMainDoc: d.type === mainDocType,
        enabled: isOcrExtractEnabled(d.type),
        mergeSameType: getOcrMergeSameType(d.type),
        templateStatus: getOcrTemplateStatus(d.type),
      }));
    });

    const ocrExtractStats = computed(() => {
      const items = ocrExtractItems.value;
      const enabledItems = items.filter((i) => i.enabled);
      return {
        total: items.length,
        enabled: enabledItems.length,
        disabled: items.length - enabledItems.length,
      };
    });

    const sceneDocTypes = computed(() => form.scene.documents.map((d) => d.type));

    const selectedWorkflowNode = computed(() =>
      (getActiveWf()?.nodes || []).find((n) => n.id === selectedWorkflowNodeId.value) || null
    );

    const inspectorPanel = computed(() => {
      if (inspectorMode.value === 'edge') return 'edge';
      if (inspectorMode.value === 'scene') return 'scene';
      if (inspectorMode.value === 'overview') return 'overview';
      const node = selectedWorkflowNode.value;
      if (!node) return 'overview';
      return WORKFLOW_INSPECTOR_MAP[node.type] || 'overview';
    });

    const inspectorTitle = computed(() => {
      if (inspectorMode.value === 'edge') return '接続設定';
      if (inspectorPanel.value === 'overview') return 'ワークフロー概要';
      if (inspectorPanel.value === 'scene') return 'シーン設定';
      if (inspectorPanel.value === 'case_link') return '業務シーン';
      if (inspectorPanel.value === 'scene_aggregate') return '案件集約';
      if (inspectorPanel.value === 'scene_completeness') return '完全性検査';
      if (inspectorPanel.value === 'data_mapping') return 'データマッピング';
      if (inspectorPanel.value === 'master_match') return 'マスタ照合';
      if (inspectorPanel.value === 'mcp') return 'MCP';
      if (inspectorPanel.value === 'ocr') return 'OCR抽出';
      if (inspectorPanel.value === 'decision') return 'IF/ELSE';
      if (inspectorPanel.value === 'hitl_gate') return '人工確認';
      if (inspectorPanel.value === 'notify') return '通知';
      if (inspectorPanel.value === 'code') return 'カスタム関数';
      if (inspectorPanel.value === 'start') return '開始';
      if (inspectorPanel.value === 'end') return '終了';
      const node = selectedWorkflowNode.value;
      if (node?.label) return node.label;
      const lib = FLOW_NODE_OPTIONS[getFlowNodeKey()]?.find((l) => l.type === node?.type);
      return lib?.label || getWorkflowNodeMeta(node?.type).title || 'ノード設定';
    });

    const inspectorHeadHint = computed(() => {
      if (inspectorMode.value === 'edge') {
        return INSPECTOR_HINTS.edgeEdit;
      }
      if (inspectorMode.value === 'overview' || inspectorPanel.value === 'overview') {
        return 'ノードをクリックすると設定パネルが表示されます。';
      }
      const hintKey = INSPECTOR_HEAD_HINT_KEYS[inspectorPanel.value];
      return hintKey ? (INSPECTOR_HINTS[hintKey] || '') : '';
    });

    const workflowNodeOutputVars = computed(() =>
      getWorkflowNodeOutputVarItems(selectedWorkflowNode.value, getActiveWf()),
    );

    const showWorkflowNodeOutputSection = computed(() => {
      if (inspectorMode.value !== 'node' || !selectedWorkflowNode.value) return false;
      if (['edge', 'overview', 'scene', 'start', 'end'].includes(inspectorPanel.value)) return false;
      return workflowNodeOutputVars.value.length > 0;
    });

    const workflowNodeOutputHint = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node) return INSPECTOR_HINTS.nodeOutput;
      const key = WORKFLOW_NODE_OUTPUT_HINT_KEYS[node.type] || 'nodeOutput';
      return INSPECTOR_HINTS[key] || INSPECTOR_HINTS.nodeOutput;
    });

    function inferWorkflowOutputVarType(item) {
      const id = String(item?.id || '').toLowerCase();
      if (id.includes('files') || id.includes('list')) return id.includes('missingdocs') || id.includes('missingfields') ? 'Array[String]' : 'Array[File]';
      if (id.includes('count') || id.includes('latency')) return 'Number';
      if (id.includes('result') || id.includes('fields') || id.includes('payload')) return 'Object';
      if (id.includes('status') || id.includes('type') || id.includes('event') || id.includes('role') || id.includes('message')) return 'String';
      if (id.includes('at')) return 'DateTime';
      return 'String';
    }

    const workflowOutputVariableRows = computed(() => {
      return workflowNodeOutputVars.value.map((item) => ({
        ...item,
        name: item.id,
        dataType: inferWorkflowOutputVarType(item),
        description: item.description || item.label,
      }));
    });

    const workflowOverviewSummary = computed(() => {
      const wf = getActiveWf();
      const nodes = wf?.nodes || [];
      const chainIds = getWorkflowMainChainIds(wf);
      const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const chainLabels = chainIds.map((id) => {
        const n = nodeMap[id];
        return n ? getWorkflowNodeDisplayLabel(n) : id;
      });
      return {
        nodeCount: nodes.length,
        edgeCount: (wf?.edges || []).length,
        chainLabels,
        startNode: getWorkflowStartNode(wf),
      };
    });

    const workflowEndPreviewRows = computed(() => {
      const wf = getActiveWf();
      const nodes = wf?.nodes || [];
      const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const chainIds = getWorkflowMainChainIds(wf).filter((id) => nodeMap[id]);
      const seen = new Set();
      const ordered = [];
      chainIds.forEach((id) => {
        seen.add(id);
        ordered.push({ node: nodeMap[id], route: 'main' });
      });
      nodes
        .filter((node) => !seen.has(node.id))
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))
        .forEach((node) => ordered.push({ node, route: 'branch' }));
      return ordered.map(({ node, route }, index) => {
        const meta = getWorkflowNodeMeta(node.type);
        let summary = getWorkflowNodeCanvasSummary(node);
        if (node.type === 'start') summary = '案件集約完了 / 補件集約完了で起動';
        if (node.type === 'end') summary = 'Workflow 終了';
        if (!summary) summary = meta.desc || '概要なし';
        return {
          id: node.id,
          type: node.type,
          label: getWorkflowNodeDisplayLabel(node),
          summary,
          accent: meta.accent,
          orderLabel: String(index + 1).padStart(2, '0'),
          routeLabel: route === 'main' ? '主経路' : '分岐',
          route,
        };
      });
    });

    const reusableSceneOptions = computed(() =>
      scenes.value
        .filter((scene) => scene.id !== currentSceneId.value)
        .map((scene) => ({ value: scene.id, label: scene.name })),
    );

    const configReuseSelectedSource = computed(() =>
      scenes.value.find((scene) => scene.id === configReuseDraft.sourceSceneId) || null,
    );

    const nodeReuseSceneOptions = computed(() =>
      scenes.value
        .filter((scene) => scene.id !== currentSceneId.value)
        .map((scene) => ({ value: scene.id, label: scene.name })),
    );

    function getReusableNodeTypeLabel(type) {
      return getWorkflowNodeMeta(type)?.title || type || 'ノード';
    }

    const nodeReuseSelectedSource = computed(() =>
      scenes.value.find((scene) => scene.id === nodeReuseDraft.sourceSceneId) || null,
    );

    const sceneReuseReviewVisible = computed(() =>
      !!(form.scene && form.scene.reuseReview && !form.scene.reuseReview.step1Confirmed),
    );

    const selectedNodeReuseReviewVisible = computed(() =>
      inspectorMode.value === 'node'
      && !!(selectedWorkflowNode.value && selectedWorkflowNode.value.reuseReview)
      && !inspectorExpanded.value,
    );

    function loadReusableSceneForm(sceneId) {
      const scene = scenes.value.find((s) => s.id === sceneId);
      if (!scene) return null;
      const stored = loadSceneFromStorage(sceneId);
      return normalizeLoadedForm(stored) || sceneFormByScene(scene);
    }

    function createReuseCheck(status, title, detail) {
      return { status, title, detail };
    }

    function getReuseStatusTone(status) {
      if (status === 'ok') return 'success';
      if (status === 'blocked') return 'danger';
      return 'warning';
    }

    function getReuseStatusLabel(status) {
      if (status === 'ok') return '構造OK';
      if (status === 'blocked') return '不可用';
      return '要確認';
    }

    function collectSceneDocTypes(data) {
      return (data?.scene?.documents || []).map((doc) => doc.type).filter(Boolean);
    }

    function buildStructureReuseChecks(scope, sourceData, targetData, nodeType = '') {
      const sourceDocTypes = collectSceneDocTypes(sourceData);
      const targetDocTypes = collectSceneDocTypes(targetData);
      const missingDocTypes = sourceDocTypes.filter((type) => !targetDocTypes.includes(type));
      const checks = [];

      checks.push(createReuseCheck(
        missingDocTypes.length ? 'warn' : 'ok',
        '帳票タイプ',
        missingDocTypes.length
          ? `現在のシーンにない帳票があります：${missingDocTypes.map(getDocDisplayLabel).join('、')}`
          : 'コピー元で参照している帳票タイプは現在のシーンで確認できます。',
      ));

      if (scope === 'step1') {
        checks.push(createReuseCheck(
          'warn',
          '案件集約キー',
          '主帳票、主帳票キー、関連キー、比較方式はコピー後も必ず手動確認してください。',
        ));
        checks.push(createReuseCheck(
          'warn',
          '関連プレビュー',
          'コピー後は関連プレビューで主副帳票の接続状態を確認するまで有効扱いにしません。',
        ));
      }

      if (scope === 'step2' || nodeType) {
        checks.push(createReuseCheck(
          missingDocTypes.length ? 'warn' : 'ok',
          'OCRフィールド参照',
          missingDocTypes.length
            ? '帳票タイプ差分があるため、OCRフィールド参照はコピー後に確認が必要です。'
            : '帳票タイプが一致しているため、OCRフィールド参照は構造上コピー可能です。',
        ));
        checks.push(createReuseCheck(
          'warn',
          '上流変数',
          'ノード順序や削除済みノードの出力変数はコピー後に構造チェックします。業務上の妥当性は判断しません。',
        ));
      }

      if (nodeType === 'data_mapping' || scope === 'step2') {
        checks.push(createReuseCheck(
          'warn',
          '標準変数名',
          '同名の標準変数がある場合は上書きせず、要確認として表示します。',
        ));
      }

      if (nodeType === 'master_match' || scope === 'step2') {
        checks.push(createReuseCheck(
          'warn',
          'マスタ参照',
          'コピー元のマスタ辞書/API が現在環境で利用できるかを確認してください。',
        ));
      }

      if (scope === 'step3') {
        checks.push(createReuseCheck(
          'warn',
          '導出フィールド',
          'Data Mapping に存在しない導出フィールドは無効化し、要確認として残します。',
        ));
      }

      return checks;
    }

    function summarizeReuseStatus(checks) {
      if ((checks || []).some((item) => item.status === 'blocked')) return 'blocked';
      if ((checks || []).some((item) => item.status === 'warn')) return 'needs_confirmation';
      return 'ok';
    }

    function buildConfigReuseReview(sourceScene, scopes, sourceData, targetData) {
      const checks = (scopes || []).flatMap((scope) =>
        buildStructureReuseChecks(scope, sourceData, targetData).map((item) => ({
          ...item,
          scope,
        })),
      );
      return {
        sourceSceneId: sourceScene.id,
        sourceSceneName: sourceScene.name,
        scopes: [...(scopes || [])],
        status: summarizeReuseStatus(checks),
        checks,
        note: '構造依存と参照欠落のみチェックします。業務上の妥当性は自動判断しません。',
      };
    }

    function buildNodeReuseReview(type, sourceScene, sourceData) {
      const checks = buildStructureReuseChecks('node', sourceData, form, type);
      return {
        sourceSceneId: sourceScene.id,
        sourceSceneName: sourceScene.name,
        nodeType: type,
        status: summarizeReuseStatus(checks),
        checks,
        note: '構造依存と参照欠落のみチェックします。業務上の妥当性は自動判断しません。',
      };
    }

    function getConfigReuseScopeLabel(scope) {
      const labels = {
        step1: 'Step1 案件集約',
        step2: 'Step2 ノード設定',
        step3: 'Step3 導出設定',
        node: 'ノード設定',
      };
      return labels[scope] || scope;
    }

    const wfLibraryFilteredGroups = computed(() => {
      const q = wfLibrarySearch.value.trim().toLowerCase();
      return CASE_FLOW_NODE_GROUPS.map((group) => ({
        category: group.category,
        nodes: group.nodes.filter((n) => {
          if (!q) return true;
          const meta = getWorkflowNodeMeta(n.type);
          return [n.label, n.summary || '', meta.title, meta.desc || ''].some(
            (s) => String(s).toLowerCase().includes(q),
          );
        }),
      })).filter((g) => g.nodes.length);
    });

    const selectedWorkflowEdge = computed(() => {
      if (!selectedWorkflowEdgeKey.value) return null;
      return (getActiveWf()?.edges || []).find((e) => workflowEdgeKey(e) === selectedWorkflowEdgeKey.value) || null;
    });

    const workflowNodeOptions = computed(() => (excludeId) =>
      (getActiveWf()?.nodes || [])
        .filter((n) => n.id !== excludeId)
        .map((n) => ({
          value: n.id,
          label: getWorkflowNodeDisplayLabel(n),
        })));

    function workflowEdgeKey(edge) {
      return `${edge.from}|${edge.to}|${edge.branch || ''}`;
    }

    function getWorkflowEdgeSummary(edge) {
      if (!edge) return '';
      const nodes = getActiveWf()?.nodes || [];
      const from = nodes.find((n) => n.id === edge.from);
      const to = nodes.find((n) => n.id === edge.to);
      const fromLabel = from ? getWorkflowNodeDisplayLabel(from) : edge.from;
      const toLabel = to ? getWorkflowNodeDisplayLabel(to) : edge.to;
      const branch = edge.branch ? `（${edge.label || edge.branch.toUpperCase()}）` : '';
      return `${fromLabel} → ${toLabel}${branch}`;
    }

    function isDecisionConditionAuto(node) {
      return node?.type === 'decision' && node.conditionType !== 'custom';
    }

    function isDecisionConditionPreset(condition) {
      return !!condition?.preset && condition.preset !== 'custom';
    }

    function isDecisionCasePreset(decisionCase) {
      return (decisionCase?.conditions || []).some((c) => isDecisionConditionPreset(c));
    }

    let workflowEdgePathsEvalCount = 0;
    const workflowEdgePaths = computed(() => {
      workflowEdgePathsEvalCount += 1;
      if (workflowEdgePathsEvalCount <= 20 || workflowEdgePathsEvalCount % 100 === 0) {
      }
      const nodes = getActiveWf()?.nodes || [];
      const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const PORT = 6;

      return (getActiveWf()?.edges || []).map((edge) => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        if (from.type === 'decision' && !edge.branch) return null;
        const fromSummary = getWorkflowNodeCanvasSummary(from);
        const toSummary = getWorkflowNodeCanvasSummary(to);
        const fromSize = getWorkflowNodeDisplaySize(from, fromSummary);
        const toSize = getWorkflowNodeDisplaySize(to, toSummary);
        const toCy = to.y + toSize.h / 2;

        let x1; let y1; let x2; let y2;
        if (from.type === 'decision' && edge.branch) {
          const start = getWorkflowPortPosition(from, edge.branch);
          x1 = start.x;
          y1 = start.y;
          x2 = to.x - PORT;
          y2 = toCy;
        } else {
          x1 = from.x + fromSize.w + PORT;
          y1 = from.y + fromSize.h / 2;
          x2 = to.x - PORT;
          y2 = toCy;
        }

        const d = wfBezierPath(x1, y1, x2, y2);
        const mid = wfBezierPoint(x1, y1, x2, y2, 0.5);
        const labelAnchor = wfBezierPoint(x1, y1, x2, y2, from.type === 'decision' && edge.branch ? 0.32 : 0.42);

        const branchLabel = from.type === 'decision' && edge.branch
          ? getDecisionBranchEdgeLabel(edge.branch, from)
          : (edge.label || '');
        const label = branchLabel;
        const labelClass = from.type === 'decision' && edge.branch === 'if'
          ? 'idp-edge-label--yes'
          : from.type === 'decision' && edge.branch === 'else'
            ? 'idp-edge-label--no'
            : '';

        return {
          d,
          label,
          labelClass,
          lx: labelAnchor.x,
          ly: labelAnchor.y - 14,
          mx: mid.x,
          my: mid.y,
          key: workflowEdgeKey(edge),
          edge,
        };
      }).filter(Boolean);
    });

    const wfCanvasStageStyle = computed(() => ({
      transform: `translate(${wfViewport.x}px, ${wfViewport.y}px) scale(${wfViewport.scale})`,
      transformOrigin: '0 0',
    }));

    const wfZoomPercent = computed(() => Math.round(wfViewport.scale * 100));

    const workflowStageSize = computed(() => {
      const bounds = getWorkflowBounds();
      return {
        width: Math.max(2400, bounds.maxX + 120),
        height: Math.max(900, bounds.maxY + 120),
      };
    });

    function getWorkflowBounds(padding = 48) {
      const nodes = getActiveWf()?.nodes || [];
      if (!nodes.length) {
        return { minX: 0, minY: 0, maxX: 1200, maxY: 600, width: 1200, height: 600 };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      nodes.forEach((node) => {
        const summary = getWorkflowNodeCanvasSummary(node);
        const size = getWorkflowNodeDisplaySize(node, summary);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + size.w + 20);
        maxY = Math.max(maxY, node.y + size.h + 20);
      });
      return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      };
    }

    function clampWorkflowZoom(scale) {
      return Math.min(WF_ZOOM_MAX, Math.max(WF_ZOOM_MIN, scale));
    }

    function screenToWorkflowCoords(clientX, clientY) {
      const el = wfCanvasViewportRef.value;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - wfViewport.x) / wfViewport.scale,
        y: (clientY - rect.top - wfViewport.y) / wfViewport.scale,
      };
    }

    function fitWorkflowToView() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      const bounds = getWorkflowBounds(64);
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (!vw || !vh) return;
      const scale = clampWorkflowZoom(Math.min(vw / bounds.width, vh / bounds.height) * 0.92);
      wfViewport.scale = scale;
      wfViewport.x = (vw - bounds.width * scale) / 2 - bounds.minX * scale;
      wfViewport.y = (vh - bounds.height * scale) / 2 - bounds.minY * scale;
    }

    function zoomWorkflowAt(clientX, clientY, factor) {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const nextScale = clampWorkflowZoom(wfViewport.scale * factor);
      const ratio = nextScale / wfViewport.scale;
      wfViewport.x = px - (px - wfViewport.x) * ratio;
      wfViewport.y = py - (py - wfViewport.y) * ratio;
      wfViewport.scale = nextScale;
    }

    function zoomWorkflowIn() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      zoomWorkflowAt(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2, WF_ZOOM_STEP);
    }

    function zoomWorkflowOut() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      zoomWorkflowAt(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2, 1 / WF_ZOOM_STEP);
    }

    function resetWorkflowZoom() {
      const el = wfCanvasViewportRef.value;
      if (!el) return;
      zoomWorkflowAt(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().top + el.clientHeight / 2, 1 / wfViewport.scale);
    }

    function organizeWorkflowNodes() {
      const wf = getActiveWf();
      if (!wf) return;
      layoutWorkflowGraph(wf);
      pushWorkflowHistory('ノードを整列');
      closeWfNodePicker();
      nextTick(() => fitWorkflowToView());
    }

    function toggleWorkflowCanvasMaximized() {
      wfCanvasMaximized.value = !wfCanvasMaximized.value;
      closeWfNodePicker();
      nextTick(() => fitWorkflowToView());
    }

    function collapseWorkflowNodes() {
      wfCanvasNodesCollapsed.value = true;
    }

    function expandWorkflowNodes() {
      wfCanvasNodesCollapsed.value = false;
    }

    function toggleWorkflowNodesCollapsed() {
      wfCanvasNodesCollapsed.value = !wfCanvasNodesCollapsed.value;
    }

    function getWorkflowNodeDisplaySize(node, summary = null) {
      const displayNode = wfCanvasNodesCollapsed.value && !isWorkflowTerminalNode(node)
        ? { ...node, __collapsed: true }
        : node;
      const resolved = summary ?? getWorkflowNodeCanvasSummary(node);
      const taskItems = workflowNodeSummaryTasks(resolved);
      return getWorkflowNodeSize(displayNode, taskItems.length, taskItems);
    }

    function onWfViewportWheel(event) {
      zoomWorkflowAt(event.clientX, event.clientY, event.deltaY > 0 ? 1 / WF_ZOOM_STEP : WF_ZOOM_STEP);
    }

    function openWorkflowInspector(mode = 'node') {
      inspectorPanelCollapsed.value = false;
      inspectorMode.value = mode;
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, '0');
      } catch (e) { /* ignore */ }
    }

    function closeWorkflowInspector() {
      inspectorPanelCollapsed.value = true;
      inspectorExpanded.value = false;
      restoreSceneSidebarAfterEditor();
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, '1');
      } catch (e) { /* ignore */ }
    }

    function onWfViewportPointerDown(event) {
      if (event.target.closest('.wf-node') || event.target.closest('.idp-edge-path') || event.target.closest('.wf-node-picker') || event.target.closest('.wf-canvas-toolbar') || event.target.closest('.wf-canvas-floating-actions')) return;
      closeWfNodePicker();
      wfConnectSourceId.value = null;
      if (wfConnectDrag.fromId) return;
      selectedWorkflowEdgeKey.value = null;
      selectedWorkflowNodeId.value = null;
      syncCurrentNodeFromWorkflow(null);
      closeWorkflowInspector();
      if (event.button !== 0) return;
      wfPanDrag.active = true;
      wfPanDrag.startX = event.clientX;
      wfPanDrag.startY = event.clientY;
      wfPanDrag.originX = wfViewport.x;
      wfPanDrag.originY = wfViewport.y;
      document.body.classList.add('wf-panning');
      const onMove = (ev) => {
        if (!wfPanDrag.active) return;
        wfViewport.x = wfPanDrag.originX + ev.clientX - wfPanDrag.startX;
        wfViewport.y = wfPanDrag.originY + ev.clientY - wfPanDrag.startY;
      };
      const onUp = () => {
        wfPanDrag.active = false;
        document.body.classList.remove('wf-panning');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function workflowTerminalTypeExists(type) {
      return (getActiveWf()?.nodes || []).some((n) => n.type === type);
    }

    function warnWorkflowTerminalLimit(type) {
      const label = type === 'start' ? '開始' : '終了';
      ElementPlus.ElMessage.warning(`${label}ノードは1つのみ追加できます`);
    }

    function createWorkflowNodeAt(type, x, y) {
      const meta = getWorkflowNodeMeta(type);
      const id = newRuleId('wf');
      const base = {
        id,
        type,
        x: Math.max(8, x),
        y: Math.max(8, y),
        label: meta?.title || type,
      };
      let node;
      if (type === 'start') {
        if (workflowTerminalTypeExists('start')) {
          warnWorkflowTerminalLimit('start');
          return null;
        }
        node = normalizeStartNode({ ...base, isStart: true });
      } else if (type === 'end') {
        if (workflowTerminalTypeExists('end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        node = normalizeEndNode({ ...base, isEnd: true });
      } else if (type === 'decision') {
        node = normalizeDecisionNode({ ...base, label: '条件判断', judgmentContext: 'custom' }, getActiveWf(), form.verify);
      } else if (type === 'hitl_gate') node = normalizeHitlGateNode(base);
      else if (type === 'notify') node = normalizeNotifyNode(base);
      else if (type === 'code') node = normalizeCodeNode(base, getActiveWf());
      else if (type === 'data_mapping') node = normalizeDataMappingNode({ ...base, label: 'データマッピング' }, getActiveWf());
      else if (type === 'master_match') node = normalizeMasterMatchNode(base, getActiveWf());
      else node = ensureWorkflowNodeVarName(base, getActiveWf());
      getActiveWf().nodes.push(node);
      if (type === 'start') ensureWorkflowStartNode(getActiveWf());
      selectWorkflowNode(id);
      pushWorkflowHistory('ノードを追加');
      return id;
    }

    function addWorkflowNodeFromLibrary(type) {
      const last = getActiveWf()?.nodes?.slice(-1)[0];
      if (last) {
        insertWorkflowNodeAfter(last.id, { kind: 'process', type });
      } else {
        createWorkflowNodeAt(type, 40, 220);
      }
    }

    function hasWorkflowIncomingEdge(nodeId) {
      const wf = getActiveWf();
      if (!nodeId || !wf?.edges?.length) return false;
      return wf.edges.some((e) => e.to === nodeId);
    }

    function showWfNodeAddBtn(node) {
      if (!isWorkflowTopologyEditable.value) return false;
      return node && !isWorkflowTerminalNode(node) && node.type !== 'decision';
    }

    function showWfNodeAddInBtn(node) {
      if (!showWfNodeAddBtn(node)) return false;
      if (node.type === 'start') return false;
      return !hasWorkflowIncomingEdge(node.id);
    }

    function workflowCoordsToScreen(x, y) {
      const el = wfCanvasViewportRef.value;
      if (!el) return { x: 120, y: 120 };
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + wfViewport.x + x * wfViewport.scale,
        y: rect.top + wfViewport.y + y * wfViewport.scale,
      };
    }

    function openWfNodePickerAt(node, side = 'after') {
      if (!node) return;
      const summary = getWorkflowNodeCanvasSummary(node);
      const size = getWorkflowNodeDisplaySize(node, summary);
      const wx = side === 'before' ? node.x - 8 : node.x + size.w + 8;
      const wy = node.y + size.h / 2;
      const screen = workflowCoordsToScreen(wx, wy);
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.side = side === 'before' ? 'before' : 'after';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      wfNodePicker.screenX = side === 'before'
        ? Math.max(8, screen.x - 280)
        : Math.min(window.innerWidth - 300, screen.x);
      wfNodePicker.screenY = Math.max(8, screen.y - 24);
      wfNodePicker.visible = true;
    }

    function openWfNodePickerFromShortcut() {
      if (!assertWorkflowTopologyEditable()) return;
      if (wfNodePicker.visible) {
        closeWfNodePicker();
        return;
      }
      const wf = getActiveWf();
      if (selectedWorkflowEdge.value) {
        const edge = selectedWorkflowEdge.value;
        wfNodePicker.fromNodeId = edge.from;
        wfNodePicker.toNodeId = edge.to;
        wfNodePicker.edgeBranch = edge.branch || null;
        wfNodePicker.edgeKey = workflowEdgeKey(edge);
        wfNodePicker.side = 'on-edge';
        wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
        wfNodePicker.hoveredLogic = null;
        const from = wf.nodes.find((n) => n.id === edge.from);
        const to = wf.nodes.find((n) => n.id === edge.to);
        const mid = from && to
          ? workflowCoordsToScreen((from.x + to.x) / 2, (from.y + to.y) / 2)
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        wfNodePicker.screenX = Math.min(window.innerWidth - 300, mid.x);
        wfNodePicker.screenY = Math.max(8, mid.y - 24);
        wfNodePicker.visible = true;
        return;
      }
      let node = selectedWorkflowNode.value;
      if (!node) {
        const chain = getWorkflowMainChainIds(wf);
        const id = chain[chain.length - 1] || wf.nodes[0]?.id;
        node = wf.nodes.find((n) => n.id === id);
      }
      if (!node) return;
      openWfNodePickerAt(node, 'after');
    }

    function resolveWfPickerAnchorRect(anchor) {
      if (!anchor) return null;
      if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
      if (anchor.currentTarget?.getBoundingClientRect) return anchor.currentTarget.getBoundingClientRect();
      return null;
    }

    function openWfNodePicker(node, anchor, side = 'after') {
      if (!assertWorkflowTopologyEditable()) return;
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.side = side === 'before' ? 'before' : 'after';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = resolveWfPickerAnchorRect(anchor);
      if (!rect) {
        openWfNodePickerAt(node, side);
        return;
      }
      if (side === 'before') {
        wfNodePicker.screenX = Math.max(8, rect.left - 280);
        wfNodePicker.screenY = Math.max(8, rect.top - 8);
      } else {
        wfNodePicker.screenX = rect.right + 8;
        wfNodePicker.screenY = Math.max(8, rect.top - 8);
      }
      wfNodePicker.visible = true;
    }

    function openWfNodePickerForDecisionBranch(node, branchKey, anchor) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!node || node.type !== 'decision') return;
      const branches = getDecisionNodeBranches(node);
      const match = branches.find((b) => b.key === branchKey);
      const ratio = match?.ratio ?? 0.5;
      const size = getWorkflowNodeSize(node);
      const screen = workflowCoordsToScreen(node.x + size.w + 8, node.y + size.h * ratio);
      wfNodePicker.fromNodeId = node.id;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = branchKey;
      wfNodePicker.side = 'branch';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = resolveWfPickerAnchorRect(anchor);
      wfNodePicker.screenX = rect
        ? Math.min(window.innerWidth - 300, rect.right + 8)
        : Math.min(window.innerWidth - 300, screen.x);
      wfNodePicker.screenY = rect
        ? Math.max(8, rect.top - 8)
        : Math.max(8, screen.y - 24);
      wfNodePicker.visible = true;
    }

    function closeWfNodePicker() {
      wfNodePicker.visible = false;
      wfNodePicker.fromNodeId = null;
      wfNodePicker.toNodeId = null;
      wfNodePicker.edgeKey = null;
      wfNodePicker.edgeBranch = null;
      wfNodePicker.hoveredLogic = null;
    }

    function openWfNodePickerOnEdge(edge, event) {
      if (!assertWorkflowTopologyEditable()) return;
      wfNodePicker.fromNodeId = edge.from;
      wfNodePicker.toNodeId = edge.to;
      wfNodePicker.edgeBranch = edge.branch || null;
      wfNodePicker.edgeKey = workflowEdgeKey(edge);
      wfNodePicker.side = 'on-edge';
      wfNodePicker.tab = wfNodePickerAvailableProcessGroups.value.length ? 'nodes' : 'logic';
      wfNodePicker.hoveredLogic = null;
      const rect = event.currentTarget.getBoundingClientRect();
      wfNodePicker.screenX = Math.min(window.innerWidth - 300, rect.right + 8);
      wfNodePicker.screenY = Math.max(8, rect.top - 8);
      wfNodePicker.visible = true;
      selectedWorkflowEdgeKey.value = workflowEdgeKey(edge);
      selectedWorkflowNodeId.value = null;
      inspectorMode.value = 'edge';
    }

    function onWorkflowEdgeMouseEnter(edgeKey) {
      hoveredWorkflowEdgeKey.value = edgeKey;
    }

    function onWorkflowEdgeMouseLeave(edgeKey) {
      if (hoveredWorkflowEdgeKey.value === edgeKey) hoveredWorkflowEdgeKey.value = null;
    }

    function isWorkflowEdgeInsertVisible(edgeKey) {
      return hoveredWorkflowEdgeKey.value === edgeKey || selectedWorkflowEdgeKey.value === edgeKey;
    }

    function buildWorkflowNodeFromPayload(payload, x, y, wf) {
      const newId = newRuleId('wf');
      if (payload.kind === 'terminal' || payload.type === 'start' || payload.type === 'end') {
        const terminalType = payload.type;
        if (terminalType === 'start') {
          if (wf?.nodes?.some((n) => n.type === 'start')) {
            warnWorkflowTerminalLimit('start');
            return null;
          }
          return normalizeStartNode({
            id: newId,
            type: 'start',
            x,
            y,
            label: payload.label || '開始',
            isStart: true,
          });
        }
        if (wf?.nodes?.some((n) => n.type === 'end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        return normalizeEndNode({
          id: newId,
          type: 'end',
          x,
          y,
          label: payload.label || '終了',
          isEnd: true,
        });
      }
      if (payload.kind === 'logic') {
        return normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x,
          y: y + 12,
          label: '条件判断',
          judgmentContext: 'custom',
          conditionType: 'custom',
        }, wf, form.verify);
      }
      if (payload.type === 'hitl_gate') {
        const preset = HITL_CONTEXT_OPTIONS.find((t) => t.value === payload.defaultPreset) || HITL_CONTEXT_OPTIONS[0];
        return normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x,
          y,
          hitlContext: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      }
      if (payload.type === 'notify') {
        return normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x,
          y,
          template: payload.defaultNotifyTemplate || 'supplement',
        });
      }
      if (payload.type === 'code') {
        return normalizeCodeNode({ id: newId, type: 'code', x, y, label: 'カスタム関数' }, wf);
      }
      if (payload.type === 'data_mapping') {
        return normalizeDataMappingNode({ id: newId, type: 'data_mapping', x, y, label: 'データマッピング' }, wf);
      }
      if (payload.type === 'master_match') {
        return normalizeMasterMatchNode({
          id: newId,
          type: 'master_match',
          x,
          y,
          label: 'マスタ照合',
          matchMethod: 'hybrid',
          resultReturn: 'array',
          matchRules: [],
        }, wf);
      }
      const meta = getWorkflowNodeMeta(payload.type);
      return ensureWorkflowNodeVarName({
        id: newId,
        type: payload.type,
        x,
        y,
        label: meta.title,
      }, wf);
    }

    function insertWorkflowNodeOnEdge(edge, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const from = wf?.nodes?.find((n) => n.id === edge.from);
      const to = wf?.nodes?.find((n) => n.id === edge.to);
      if (!from || !to || !edge) return null;

      const edgeIdx = wf.edges.findIndex((e) => workflowEdgeKey(e) === workflowEdgeKey(edge));
      if (edgeIdx < 0) return null;

      const fromTasks = getWorkflowNodeActiveTasks(from);
      const fromSize = getWorkflowNodeSize(from, fromTasks.length, fromTasks);
      const toTasks = getWorkflowNodeActiveTasks(to);
      const toSize = getWorkflowNodeSize(to, toTasks.length, toTasks);

      const newNode = buildWorkflowNodeFromPayload(
        payload,
        from.x + fromSize.w + WF_NODE_GAP,
        Math.round((from.y + fromSize.h / 2 + to.y + toSize.h / 2) / 2 - 44),
        wf,
      );
      if (!newNode) return null;
      const newSize = getWorkflowNodeSize(newNode, getWorkflowNodeActiveTasks(newNode).length, getWorkflowNodeActiveTasks(newNode));
      const neededRight = from.x + fromSize.w + WF_NODE_GAP + newSize.w + WF_NODE_GAP;
      if (to.x < neededRight) {
        shiftWorkflowNodesRight(to.id, neededRight - to.x, wf);
      }
      newNode.x = from.x + fromSize.w + WF_NODE_GAP;
      newNode.y = Math.round((from.y + fromSize.h / 2 + to.y + toSize.h / 2) / 2 - newSize.h / 2);

      wf.edges.splice(edgeIdx, 1);
      if (from.type === 'decision' && edge.branch) {
        wf.edges.push({
          from: edge.from,
          to: newNode.id,
          branch: edge.branch,
          label: edge.label || getDecisionBranchEdgeLabel(edge.branch, from),
        });
      } else {
        wf.edges.push({ from: edge.from, to: newNode.id });
      }
      if (payload.kind === 'logic') {
        wf.edges.push({
          from: newNode.id,
          to: edge.to,
          branch: 'else',
          label: getDecisionBranchEdgeLabel('else', newNode),
        });
      } else {
        wf.edges.push({ from: newNode.id, to: edge.to });
      }

      wf.nodes.push(newNode);
      if (payload.kind === 'terminal' && payload.type === 'start') ensureWorkflowStartNode(wf);
      closeWfNodePicker();
      selectWorkflowNode(newNode.id);
      pushWorkflowHistory(payload.kind === 'logic' ? '接続線にロジックノードを挿入' : '接続線にノードを挿入');
      nextTick(() => fitWorkflowToView());
      return newNode.id;
    }

    function shiftWorkflowNodesRight(fromId, delta, workflow = getActiveWf()) {
      const wf = workflow;
      if (!wf || !delta) return;
      const visited = new Set();
      const queue = [fromId];
      while (queue.length) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const node = wf.nodes.find((n) => n.id === id);
        if (node) node.x += delta;
        wf.edges.filter((e) => e.from === id).forEach((e) => queue.push(e.to));
      }
    }

    function insertWorkflowNodeBefore(toId, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const to = wf?.nodes?.find((n) => n.id === toId);
      if (!to || !payload) return null;

      if (payload.kind === 'terminal' && payload.type === 'start') {
        if (workflowTerminalTypeExists('start')) {
          warnWorkflowTerminalLimit('start');
          return null;
        }
        const newId = newRuleId('wf');
        const newNode = normalizeStartNode({
          id: newId,
          type: 'start',
          x: to.x,
          y: to.y - WORKFLOW_NODE_SIZE.terminal.h - WF_NODE_GAP,
          label: payload.label || '開始',
          isStart: true,
        });
        const incomingEdges = wf.edges.filter((e) => e.to === toId);
        incomingEdges.forEach((edge) => { edge.to = newId; });
        wf.nodes.push(newNode);
        wf.edges.push({ from: newId, to: toId });
        ensureWorkflowStartNode(wf);
        closeWfNodePicker();
        selectWorkflowNode(newId);
        pushWorkflowHistory('開始ノードを挿入');
        nextTick(() => fitWorkflowToView());
        return newId;
      }

      const newId = newRuleId('wf');
      let newNode;

      if (payload.kind === 'terminal' && payload.type === 'end') {
        if (workflowTerminalTypeExists('end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        newNode = normalizeEndNode({
          id: newId,
          type: 'end',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          label: payload.label || '終了',
          isEnd: true,
        });
      } else if (payload.kind === 'logic') {
        newNode = normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x: to.x - WF_NODE_GAP,
          y: to.y + 12,
          label: '条件判断',
          judgmentContext: 'custom',
          conditionType: 'custom',
        }, wf, form.verify);
      } else if (payload.type === 'hitl_gate') {
        const preset = HITL_CONTEXT_OPTIONS.find((t) => t.value === payload.defaultPreset) || HITL_CONTEXT_OPTIONS[0];
        newNode = normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          hitlContext: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      } else if (payload.type === 'notify') {
        newNode = normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          template: payload.defaultNotifyTemplate || 'supplement',
        });
      } else if (payload.type === 'code') {
        newNode = normalizeCodeNode({
          id: newId,
          type: 'code',
          x: to.x - WF_NODE_GAP,
          y: to.y,
          label: 'カスタム関数',
        }, wf);
      } else {
        const meta = getWorkflowNodeMeta(payload.type);
        newNode = ensureWorkflowNodeVarName({
          id: newId,
          type: payload.type,
          x: to.x - WF_NODE_GAP,
          y: to.y,
          label: meta.title,
        }, wf);
      }

      const newSize = getWorkflowNodeSize(newNode, getWorkflowNodeActiveTasks(newNode).length, getWorkflowNodeActiveTasks(newNode));
      shiftWorkflowNodesRight(toId, newSize.w + WF_NODE_GAP);
      newNode.x = to.x - newSize.w - WF_NODE_GAP;

      const incomingEdges = wf.edges.filter((e) => e.to === toId);
      incomingEdges.forEach((edge) => { edge.to = newId; });
      wf.nodes.push(newNode);
      if (payload.kind === 'logic') {
        wf.edges.push({
          from: newId,
          to: toId,
          branch: 'else',
          label: getDecisionBranchEdgeLabel('else', newNode),
        });
      } else {
        wf.edges.push({ from: newId, to: toId });
      }

      closeWfNodePicker();
      selectWorkflowNode(newId);
      pushWorkflowHistory(payload.kind === 'logic' ? 'ロジックノードを挿入' : 'ノードを挿入');
      nextTick(() => fitWorkflowToView());
      return newId;
    }

    function insertWorkflowNodeAfter(fromId, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const from = wf?.nodes?.find((n) => n.id === fromId);
      if (!from || !payload) return null;

      const fromTasks = getWorkflowNodeActiveTasks(from);
      const fromSize = getWorkflowNodeSize(from, fromTasks.length, fromTasks);

      if (payload.kind === 'terminal' && payload.type === 'end') {
        if (workflowTerminalTypeExists('end')) {
          warnWorkflowTerminalLimit('end');
          return null;
        }
        const newId = newRuleId('wf');
        const newNode = normalizeEndNode({
          id: newId,
          type: 'end',
          x: from.x,
          y: from.y + fromSize.h + WF_NODE_GAP,
          label: payload.label || '終了',
          isEnd: true,
        });
        const mainEdge = wf.edges.find((e) => e.from === fromId && !e.branch);
        const oldTargetId = mainEdge?.to || null;
        if (mainEdge) wf.edges = wf.edges.filter((e) => e !== mainEdge);
        wf.nodes.push(newNode);
        wf.edges.push({ from: fromId, to: newId });
        if (oldTargetId) wf.edges.push({ from: newId, to: oldTargetId });
        closeWfNodePicker();
        selectWorkflowNode(newId);
        pushWorkflowHistory('終了ノードを挿入');
        nextTick(() => fitWorkflowToView());
        return newId;
      }

      if (payload.kind === 'terminal' && payload.type === 'start') {
        if (workflowTerminalTypeExists('start')) {
          warnWorkflowTerminalLimit('start');
          return null;
        }
        const newId = newRuleId('wf');
        const newNode = normalizeStartNode({
          id: newId,
          type: 'start',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          label: payload.label || '開始',
          isStart: true,
        });
        const mainEdge = wf.edges.find((e) => e.from === fromId && !e.branch);
        const oldTargetId = mainEdge?.to || null;
        if (mainEdge) wf.edges = wf.edges.filter((e) => e !== mainEdge);
        wf.nodes.push(newNode);
        wf.edges.push({ from: fromId, to: newId });
        if (oldTargetId) wf.edges.push({ from: newId, to: oldTargetId });
        ensureWorkflowStartNode(wf);
        closeWfNodePicker();
        selectWorkflowNode(newId);
        pushWorkflowHistory('開始ノードを挿入');
        nextTick(() => fitWorkflowToView());
        return newId;
      }

      const newId = newRuleId('wf');
      let newNode;

      if (payload.kind === 'logic') {
        newNode = normalizeDecisionNode({
          id: newId,
          type: 'decision',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y + 12,
          label: '条件判断',
          judgmentContext: 'custom',
          conditionType: 'custom',
        }, wf, form.verify);
      } else if (payload.type === 'hitl_gate') {
        const preset = HITL_CONTEXT_OPTIONS.find((t) => t.value === payload.defaultPreset) || HITL_CONTEXT_OPTIONS[0];
        newNode = normalizeHitlGateNode({
          id: newId,
          type: 'hitl_gate',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          hitlContext: payload.defaultPreset || preset.value,
          label: '人工確認',
        });
      } else if (payload.type === 'notify') {
        newNode = normalizeNotifyNode({
          id: newId,
          type: 'notify',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          template: payload.defaultNotifyTemplate || 'supplement',
        });
      } else if (payload.type === 'code') {
        newNode = normalizeCodeNode({
          id: newId,
          type: 'code',
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          label: 'カスタム関数',
        }, wf);
      } else {
        const meta = getWorkflowNodeMeta(payload.type);
        newNode = ensureWorkflowNodeVarName({
          id: newId,
          type: payload.type,
          x: from.x + fromSize.w + WF_NODE_GAP,
          y: from.y,
          label: meta.title,
        }, wf);
      }

      const newSize = getWorkflowNodeSize(newNode, getWorkflowNodeActiveTasks(newNode).length, getWorkflowNodeActiveTasks(newNode));
      const mainEdge = wf.edges.find((e) => e.from === fromId && !e.branch);
      const oldTargetId = mainEdge?.to || null;

      if (oldTargetId) {
        shiftWorkflowNodesRight(oldTargetId, newSize.w + WF_NODE_GAP);
        wf.edges = wf.edges.filter((e) => e !== mainEdge);
      }

      wf.nodes.push(newNode);
      wf.edges.push({ from: fromId, to: newId });

      if (payload.kind === 'logic' && oldTargetId) {
        wf.edges.push({
          from: newId,
          to: oldTargetId,
          branch: 'else',
          label: getDecisionBranchEdgeLabel('else', newNode),
        });
      } else if (oldTargetId) {
        wf.edges.push({ from: newId, to: oldTargetId });
      }

      closeWfNodePicker();
      selectWorkflowNode(newId);
      pushWorkflowHistory(payload.kind === 'logic' ? 'ロジックノードを挿入' : 'ノードを挿入');
      nextTick(() => fitWorkflowToView());
      return newId;
    }

    function insertWorkflowNodeOnDecisionBranch(fromId, branchKey, payload) {
      if (!assertWorkflowTopologyEditable()) return null;
      const wf = getActiveWf();
      const from = wf?.nodes?.find((n) => n.id === fromId);
      if (!from || from.type !== 'decision' || !branchKey) return null;

      const branches = getDecisionNodeBranches(from);
      const match = branches.find((b) => b.key === branchKey);
      const ratio = match?.ratio ?? 0.5;
      const fromSize = getWorkflowNodeSize(from);
      const newNode = buildWorkflowNodeFromPayload(
        payload,
        from.x + fromSize.w + WF_NODE_GAP,
        Math.round(from.y + fromSize.h * ratio - 22),
        wf,
      );
      const newSize = getWorkflowNodeSize(
        newNode,
        getWorkflowNodeActiveTasks(newNode).length,
        getWorkflowNodeActiveTasks(newNode),
      );
      const existingEdge = wf.edges.find((e) => e.from === fromId && e.branch === branchKey);

      if (existingEdge?.to) {
        shiftWorkflowNodesRight(existingEdge.to, newSize.w + WF_NODE_GAP);
        const oldTargetId = existingEdge.to;
        existingEdge.to = newNode.id;
        wf.nodes.push(newNode);
        if (payload.kind === 'logic') {
          wf.edges.push({
            from: newNode.id,
            to: oldTargetId,
            branch: 'else',
            label: getDecisionBranchEdgeLabel('else', newNode),
          });
        } else {
          wf.edges.push({ from: newNode.id, to: oldTargetId });
        }
      } else {
        wf.nodes.push(newNode);
        wf.edges.push({
          from: fromId,
          to: newNode.id,
          branch: branchKey,
          label: getDecisionBranchEdgeLabel(branchKey, from),
        });
      }

      closeWfNodePicker();
      selectWorkflowNode(newNode.id);
      pushWorkflowHistory(`${match?.label || '分岐'} にノードを接続`);
      nextTick(() => fitWorkflowToView());
      return newNode.id;
    }

    function createWorkflowNodeFromPickerPayload(payload) {
      if (wfNodePicker.side === 'on-edge') {
        const edge = (getActiveWf()?.edges || []).find((e) => workflowEdgeKey(e) === wfNodePicker.edgeKey);
        return edge ? insertWorkflowNodeOnEdge(edge, payload) : null;
      }
      if (wfNodePicker.side === 'branch') {
        return insertWorkflowNodeOnDecisionBranch(wfNodePicker.fromNodeId, wfNodePicker.edgeBranch, payload);
      }
      if (wfNodePicker.side === 'before') {
        return insertWorkflowNodeBefore(wfNodePicker.fromNodeId, payload);
      }
      return insertWorkflowNodeAfter(wfNodePicker.fromNodeId, payload);
    }

    function createWorkflowNodeFromPendingPayload(payload, context = {}) {
      if (context?.mode === 'canvas') {
        return createWorkflowNodeAt(payload.type, context.x, context.y);
      }
      return createWorkflowNodeFromPickerPayload(payload);
    }

    function getWorkflowNodeById(nodeId) {
      return (getActiveWf()?.nodes || []).find((node) => node.id === nodeId) || null;
    }

    function canReuseWorkflowNodeType(type) {
      return REUSABLE_WORKFLOW_NODE_TYPES.has(type);
    }

    function openNodeReuseDialog(payload, context = {}) {
      nodeReusePendingPayload = cloneJson(payload);
      nodeReusePendingContext = { ...context };
      nodeReuseDraft.type = payload.type || '';
      nodeReuseDraft.sourceSceneId = nodeReuseSceneOptions.value[0]?.value || '';
      nodeReuseDialogVisible.value = true;
    }

    function clearNodeReusePending() {
      nodeReusePendingPayload = null;
      nodeReusePendingContext = null;
      nodeReuseDialogVisible.value = false;
    }

    function createBlankNodeFromReuseDialog() {
      if (!nodeReusePendingPayload) {
        clearNodeReusePending();
        return;
      }
      createWorkflowNodeFromPendingPayload(nodeReusePendingPayload, nodeReusePendingContext);
      clearNodeReusePending();
    }

    function applyNodeReuseMetadata(node, type, sourceScene, sourceData) {
      if (!node || !sourceScene) return;
      const review = buildNodeReuseReview(type, sourceScene, sourceData);
      node.reuseReview = review;
      node.reuseStatus = review.status === 'ok' ? 'ready' : 'needs_confirmation';
      node.reuseSourceSceneName = sourceScene.name;
      if (type === 'data_mapping') {
        const sourceNode = (sourceData?.workflows?.case?.nodes || []).find((n) => n.type === 'data_mapping');
        if (sourceNode?.mappingRules?.length) {
          node.mappingRules = cloneJson(sourceNode.mappingRules).map((rule) => ({
            ...rule,
            id: newRuleId('map'),
          }));
        }
      } else if (type === 'master_match') {
        const sourceNode = (sourceData?.workflows?.case?.nodes || []).find((n) => n.type === 'master_match');
        if (sourceNode?.matchRules?.length) {
          node.matchRules = cloneJson(sourceNode.matchRules).map((rule) => ({
            ...rule,
            id: newRuleId('mm'),
          }));
        }
      } else if (type === 'ai_verify') {
        node.reuseCopiedModules = ['完全性検査', 'テキスト検証', 'データ検証', '印鑑検証'];
      }
    }

    function copyNodeFromReuseDialog() {
      const sourceScene = nodeReuseSelectedSource.value;
      if (!sourceScene || !nodeReusePendingPayload) {
        ElementPlus.ElMessage.warning('コピー元シーンを選択してください');
        return;
      }
      const sourceData = loadReusableSceneForm(sourceScene.id);
      const nodeId = createWorkflowNodeFromPendingPayload(nodeReusePendingPayload, nodeReusePendingContext);
      const node = getWorkflowNodeById(nodeId);
      applyNodeReuseMetadata(node, nodeReusePendingPayload.type, sourceScene, sourceData);
      clearNodeReusePending();
      ElementPlus.ElMessage.success('設定をコピーしました。構造チェック結果を確認してください');
    }

    function confirmSelectedNodeReuseReview() {
      const node = selectedWorkflowNode.value;
      if (!node?.reuseReview) return;
      node.reuseStatus = 'ready';
      node.reuseReview.confirmed = true;
      pushWorkflowHistory('コピー設定を確認');
      ElementPlus.ElMessage.success('確認済みにしました');
    }

    function pickWorkflowProcessNode(item) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfNodePicker.fromNodeId && !wfNodePicker.edgeKey) return;
      const resolved = typeof item === 'string' ? { type: item } : item;
      const payload = resolved.type === 'start' || resolved.type === 'end'
        ? { kind: 'terminal', type: resolved.type, label: resolved.label }
        : resolved.type === 'decision'
          ? { kind: 'logic', conditionType: 'custom' }
          : {
            kind: 'process',
            type: resolved.type,
            defaultPreset: resolved.defaultHitlContext,
            defaultNotifyTemplate: resolved.defaultNotifyTemplate,
            label: resolved.label,
          };
      if (payload.type && canReuseWorkflowNodeType(payload.type) && nodeReuseSceneOptions.value.length) {
        openNodeReuseDialog(payload, { mode: 'picker' });
        return;
      }
      createWorkflowNodeFromPickerPayload(payload);
    }

    function pickWorkflowLogicNode(conditionType) {
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfNodePicker.fromNodeId && !wfNodePicker.edgeKey) return;
      const payload = { kind: 'logic', conditionType };
      if (wfNodePicker.side === 'on-edge') {
        const edge = (getActiveWf()?.edges || []).find((e) => workflowEdgeKey(e) === wfNodePicker.edgeKey);
        if (edge) insertWorkflowNodeOnEdge(edge, payload);
        return;
      }
      if (wfNodePicker.side === 'before') {
        insertWorkflowNodeBefore(wfNodePicker.fromNodeId, payload);
      } else {
        insertWorkflowNodeAfter(wfNodePicker.fromNodeId, payload);
      }
    }

    const wfNodePickerAvailableProcessGroups = computed(() => {
      const flowKey = getFlowNodeKey();
      const wf = getActiveWf();
      const hasStart = wf?.nodes?.some((n) => n.type === 'start');
      const hasEnd = wf?.nodes?.some((n) => n.type === 'end');

      if (flowKey === 'case') {
        return CASE_FLOW_NODE_GROUPS.map((group) => ({
          category: group.category,
          nodes: [...group.nodes]
            .filter((item) => {
              if (item.type === 'start' && hasStart) return false;
              if (item.type === 'end' && hasEnd) return false;
              return true;
            })
            .sort((a, b) => {
              const ao = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[a.type];
              const bo = WORKFLOW_MAIN_CHAIN_TYPE_ORDER[b.type];
              if (ao == null && bo == null) return 0;
              if (ao == null) return 1;
              if (bo == null) return -1;
              return ao - bo;
            }),
        })).filter((group) => group.nodes.length > 0);
      }

      const nodes = FLOW_NODE_OPTIONS[flowKey] || [];
      if (!nodes.length) return [];
      const grouped = {};
      nodes.forEach((item) => {
        const key = item.category || '処理';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });
      return Object.entries(grouped).map(([category, groupNodes]) => ({ category, nodes: groupNodes }));
    });

    const wfNodePickerProcessGroups = wfNodePickerAvailableProcessGroups;

    const wfNodePickerLogicOptions = computed(() => [...JUDGMENT_CONTEXT_OPTIONS]);

    function exitWorkflowInspector() {
      selectedWorkflowNodeId.value = null;
      selectedWorkflowEdgeKey.value = null;
      syncCurrentNodeFromWorkflow(null);
      closeWorkflowInspector();
    }

    const wfNodePickerHoveredLogic = computed(() => {
      if (!wfNodePicker.hoveredLogic) return null;
      return JUDGMENT_CONTEXT_OPTIONS.find((t) => t.value === wfNodePicker.hoveredLogic) || null;
    });

    function resetSceneSetupDraft() {
      sceneSetupDraft.sceneId = '';
      sceneSetupDraft.name = '新規シーン';
      sceneSetupDraft.description = '';
      sceneSetupDraft.documents = [];
      sceneSetupDraft.mainDocType = '';
      sceneSetupDraft.mainKey = '';
      sceneSetupDraft.docFieldLinks = [];
      sceneSetupDraft.aggregateRuleSettings = {};
      sceneSetupDraft.aggregateCompareStrategy = 'exact';
      clearSceneSetupLinkCheckDisplay();
    }

    function loadSceneSetupDraftFromData(data, sceneId = '', sceneName = '') {
      sceneSetupDraft.sceneId = sceneId;
      sceneSetupDraft.name = data.scene?.name || sceneName || '新規シーン';
      sceneSetupDraft.description = data.scene?.description || '';
      sceneSetupDraft.documents = normalizeSceneDocuments(cloneJson(data.scene?.documents || []));
      sceneSetupDraft.mainDocType = getSceneMainDocType(data.scene);
      sceneSetupDraft.mainKey = getSceneSetupFieldOptions(sceneSetupDraft.mainDocType).includes(data.scene?.primaryKey)
        ? data.scene.primaryKey
        : (getSceneSetupFieldOptions(sceneSetupDraft.mainDocType)[0] || '');
      applySceneSetupAggregate();
      sceneSetupDraft.docFieldLinks = normalizeDocFieldLinks(
        data.scene?.docFieldLinks,
        sceneSetupDraft.documents,
      );
      sceneSetupDraft.aggregateRuleSettings = {};
      sceneSetupDraft.aggregateCompareStrategy = SCENE_AGGREGATE_COMPARE_STRATEGIES.some((item) => item.value === data.scene?.aggregateCompareStrategy)
        ? data.scene.aggregateCompareStrategy
        : 'exact';
      if (!sceneSetupDraft.docFieldLinks.length && sceneSetupDraft.documents.length >= 2) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        );
      }
      ensureSceneSetupAggregateRuleSettings();
      clearSceneSetupLinkCheckDisplay();
    }

    function applySceneSetupDraftToData(data) {
      const name = (sceneSetupDraft.name || '').trim() || '新規シーン';
      data.scene.name = name;
      data.scene.description = (sceneSetupDraft.description || '').trim();
      data.scene.documents = normalizeSceneDocuments(cloneJson(sceneSetupDraft.documents));
      data.scene.mainDocTypes = sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [];
      data.scene.aggregateDocType = sceneSetupDraft.mainDocType;
      data.scene.primaryKey = sceneSetupDraft.mainKey || '';
      data.scene.masterlessPolicy = SCENE_MATCHING_DEFAULTS.masterlessPolicy;
      data.scene.supplementPolicy = SCENE_MATCHING_DEFAULTS.supplementPolicy;
      data.scene.docFieldLinks = normalizeDocFieldLinks(
        sceneSetupDraft.docFieldLinks,
        sceneSetupDraft.documents,
      );
      data.scene.aggregateCompareStrategy = SCENE_AGGREGATE_COMPARE_STRATEGIES.some((item) => item.value === sceneSetupDraft.aggregateCompareStrategy)
        ? sceneSetupDraft.aggregateCompareStrategy
        : 'exact';
      delete data.scene.aggregateMatchPolicy;
      delete data.scene.aggregateRuleSettings;
      applySceneAggregate(data.scene, data.scene.documents, data.output);
      return name;
    }

    function enterSceneSetupStep(mode = 'edit') {
      sceneSetupMode.value = mode;
      workflowSetupStep.value = 1;
      sceneSetupVisible.value = true;
    }

    function cancelSceneSetup() {
      sceneSetupVisible.value = false;
      workflowSetupStep.value = 2;
    }

    function resetSceneSetup() {
      ElementPlus.ElMessageBox.confirm('すべての設定をリセットしますか？', '', {
        confirmButtonText: 'OK',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }).then(() => {
        if (sceneSetupMode.value === 'edit' && sceneSetupDraft.sceneId) {
          const scene = scenes.value.find((s) => s.id === sceneSetupDraft.sceneId);
          if (!scene) {
            resetSceneSetupDraft();
          } else if (scene.id === currentSceneId.value) {
            const saved = normalizeLoadedForm(JSON.parse(savedSnapshot.value)) || form;
            loadSceneSetupDraftFromData(saved, scene.id, scene.name);
          } else {
            const stored = normalizeLoadedForm(loadSceneFromStorage(scene.id)) || sceneFormByScene(scene);
            loadSceneSetupDraftFromData(stored, scene.id, scene.name);
          }
        } else {
          resetSceneSetupDraft();
        }
        ElementPlus.ElMessage.info('リセットしました');
      }).catch(() => {});
    }

    function goToWorkflowSetupStep(step) {
      if (step === 1) {
        if (workflowSetupStep.value === 1) return;
        const scene = currentScene.value;
        if (scene) {
          editSceneSettings(scene);
          return;
        }
        resetSceneSetupDraft();
        enterSceneSetupStep('create');
        return;
      }
      if (step === 2) {
        if (workflowSetupStep.value === 2) return;
        if (workflowSetupStep.value === 1) {
          proceedToWorkflowStep();
          return;
        }
        workflowSetupStep.value = 2;
        sceneSetupVisible.value = false;
        enterWorkflowCanvasView();
        nextTick(() => fitWorkflowToView());
        return;
      }
      if (step === 3) {
        if (workflowSetupStep.value === 1) {
          proceedToWorkflowStep();
          if (workflowSetupStep.value !== 2) return;
        }
        syncOutputDocFieldsBySceneDocs();
        if (!outputSelectedDocType.value && form.output.docFields?.[0]?.docType) {
          outputSelectedDocType.value = form.output.docFields[0].docType;
        }
        currentNode.value = 'output';
        selectedWorkflowEdgeKey.value = null;
        selectedWorkflowNodeId.value = null;
        inspectorPanelCollapsed.value = true;
        sceneSetupVisible.value = false;
        workflowSetupStep.value = 3;
      }
    }

    function createNewScene() {
      if (renamingSceneId.value) {
        const prev = scenes.value.find((s) => s.id === renamingSceneId.value);
        if (prev) finishRenameScene(prev);
      }
      openConfigReuseDialog();
    }

    function resetConfigReuseDraft() {
      configReuseDraft.sourceSceneId = reusableSceneOptions.value[0]?.value || '';
      configReuseDraft.scopes = ['step1', 'step2', 'step3'];
    }

    function openConfigReuseDialog() {
      resetConfigReuseDraft();
      configReuseDialogVisible.value = true;
    }

    function createBlankSceneFromDialog() {
      configReuseDialogVisible.value = false;
      resetSceneSetupDraft();
      enterSceneSetupStep('create');
    }

    function applyConfigReuseScope(data, sourceData, scopes) {
      if ((scopes || []).includes('step1')) {
        const currentName = data.scene?.name || '新規シーン';
        data.scene = cloneJson(sourceData.scene || data.scene || {});
        data.scene.name = currentName;
      }
      if ((scopes || []).includes('step2')) {
        data.workflows = cloneJson(sourceData.workflows || data.workflows || {});
        data.processing = cloneJson(sourceData.processing || data.processing || {});
        data.verify = cloneJson(sourceData.verify || data.verify || {});
        data.master = cloneJson(sourceData.master || data.master || {});
        data.knowledgeSources = cloneJson(sourceData.knowledgeSources || data.knowledgeSources || []);
        data.mcpServers = cloneJson(sourceData.mcpServers || data.mcpServers || []);
        data.mcpToolParamProfiles = cloneJson(sourceData.mcpToolParamProfiles || data.mcpToolParamProfiles || {});
      }
      if ((scopes || []).includes('step3')) {
        data.output = cloneJson(sourceData.output || data.output || {});
      }
    }

    function copySceneFromConfigReuse() {
      const sourceScene = configReuseSelectedSource.value;
      if (!sourceScene) {
        ElementPlus.ElMessage.warning('コピー元シーンを選択してください');
        return;
      }
      if (!configReuseDraft.scopes.length) {
        ElementPlus.ElMessage.warning('コピー範囲を1つ以上選択してください');
        return;
      }
      const sourceData = loadReusableSceneForm(sourceScene.id);
      if (!sourceData) return;
      const id = String(Date.now());
      const data = sceneForm('application');
      data.scene.name = `${sourceScene.name} コピー`;
      const review = buildConfigReuseReview(sourceScene, configReuseDraft.scopes, sourceData, data);
      applyConfigReuseScope(data, sourceData, configReuseDraft.scopes);
      data.scene.name = `${sourceScene.name} コピー`;
      data.scene.reuseReview = review;
      const normalized = normalizeLoadedForm(data);
      scenes.value.unshift({ id, name: normalized.scene.name });
      saveStorage(id, normalized);
      configReuseDialogVisible.value = false;
      selectScene(id, { skipFinishRename: true, focusScene: true });
      loadSceneSetupDraftFromData(normalized, id, normalized.scene.name);
      enterSceneSetupStep('edit');
      ElementPlus.ElMessage.success('コピーしました。Step1 の内容を確認してください');
    }

    function editSceneSettings(scene) {
      if (!scene) return;
      if (scene.id === currentSceneId.value) {
        loadSceneSetupDraftFromData(form, scene.id, scene.name);
      } else {
        const stored = loadSceneFromStorage(scene.id);
        const data = normalizeLoadedForm(stored) || sceneFormByScene(scene);
        loadSceneSetupDraftFromData(data, scene.id, scene.name);
      }
      enterSceneSetupStep('edit');
    }

    function openEditCurrentSceneSettings() {
      const scene = currentScene.value;
      if (scene) editSceneSettings(scene);
    }

    function onSceneMenuCommand(command, scene) {
      if (command === 'edit') editSceneSettings(scene);
    }

    function applySceneSetupAggregate() {
      const agg = normalizeSceneAggregate(
        { mainDocTypes: sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [] },
        sceneSetupDraft.documents,
      );
      sceneSetupDraft.mainDocType = agg.mainDocTypes[0] || '';
      ensureSceneSetupAggregateRuleSettings();
    }

    function validateSceneAggregateDraft(draft) {
      if (!draft.mainDocType) return '主帳票を1件選択してください';
      if (!draft.mainKey) return '主帳票キーを選択してください';
      const invalidGroups = sceneSetupAggregateInvalidGroups.value;
      if (invalidGroups.length) {
        const names = invalidGroups.map((group) => getDocDisplayLabel(group.docType)).join('、');
        return `主帳票に未関連の帳票があります：${names}`;
      }
      return '';
    }

    function setSceneSetupMainDoc(docType) {
      if (!sceneSetupDraft.documents.some((d) => d.type === docType)) return;
      sceneSetupDraft.mainDocType = docType;
      const fields = getSceneSetupFieldOptions(docType);
      sceneSetupDraft.mainKey = fields.includes(sceneSetupDraft.mainKey) ? sceneSetupDraft.mainKey : (fields[0] || '');
      ensureSceneSetupAggregateRuleSettings();
      clearSceneSetupLinkCheckDisplay();
      if (sceneSetupDraft.documents.length >= 2 && !(sceneSetupDraft.docFieldLinks || []).length) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          [docType],
        );
      }
    }

    function proceedToWorkflowStep() {
      if (!sceneSetupDraft.documents.length) {
        ElementPlus.ElMessage.warning('関連帳票を1件以上追加してください');
        return;
      }
      applySceneSetupAggregate();
      const err = validateSceneAggregateDraft(sceneSetupDraft);
      if (err) {
        ElementPlus.ElMessage.warning(err);
        return;
      }
      sceneSetupDraft.docFieldLinks = normalizeDocFieldLinks(
        sceneSetupDraft.docFieldLinks,
        sceneSetupDraft.documents,
      );
      const linkErr = getSceneLinkValidationError(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType,
        sceneSetupDraft.docFieldLinks,
        getDocDisplayLabel,
      );
      if (linkErr) {
        flashSceneSetupLinkCheckResult();
        ElementPlus.ElMessage.warning(linkErr);
        return;
      }
      if (sceneSetupMode.value === 'edit') {
        const scene = scenes.value.find((s) => s.id === sceneSetupDraft.sceneId);
        if (!scene) return;
        if (scene.id === currentSceneId.value) {
          const name = applySceneSetupDraftToData(form);
          scene.name = name;
          syncOcrExtractTypes();
          syncOutputDocFieldsBySceneDocs();
          saveStorage(scene.id, form);
          savedSnapshot.value = JSON.stringify(form);
        } else {
          const stored = normalizeLoadedForm(loadSceneFromStorage(scene.id)) || sceneFormByScene(scene);
          const name = applySceneSetupDraftToData(stored);
          scene.name = name;
          saveStorage(scene.id, stored);
          if (scene.id === currentSceneId.value) {
            Object.assign(form, stored);
          }
        }
        sceneSetupVisible.value = false;
        workflowSetupStep.value = 2;
        enterWorkflowCanvasView();
        nextTick(() => fitWorkflowToView());
        ElementPlus.ElMessage.success('業務シーン設定を保存しました');
        return;
      }
      const id = String(Date.now());
      const data = sceneForm('application');
      const name = applySceneSetupDraftToData(data);
      scenes.value.unshift({ id, name });
      saveStorage(id, data);
      selectScene(id, { skipFinishRename: true, focusScene: true });
      sceneSetupVisible.value = false;
      workflowSetupStep.value = 2;
      enterWorkflowCanvasView();
      ElementPlus.ElMessage.success('業務シーンを作成しました');
    }

    function confirmSceneSetup() {
      proceedToWorkflowStep();
    }

    function openSceneSetupDocPicker() {
      openDocPicker('setup');
    }

    function checkSceneDocLinks() {
      if (!sceneSetupDraft.documents.length) {
        ElementPlus.ElMessage.warning('関連帳票を1件以上追加してください');
        return;
      }
      if (!sceneSetupDraft.mainDocType) {
        ElementPlus.ElMessage.warning('主帳票を選択してください');
        return;
      }
      flashSceneSetupLinkCheckResult();
      const stats = sceneSetupLinkStats.value;
      if (stats.unlinkedCount > 0) {
        const names = stats.unlinkedDocs.map((t) => getDocDisplayLabel(t)).join('、');
        ElementPlus.ElMessage.warning(`${stats.unlinkedCount} 件の帳票が主帳票に未関連です：${names}`);
      } else if (stats.total <= stats.mainDocCount) {
        ElementPlus.ElMessage.success('主帳票のみの構成です');
      } else {
        ElementPlus.ElMessage.success('すべての帳票が主帳票に関連付けされています');
      }
    }

    function removeSceneSetupDoc(index) {
      const removed = sceneSetupDraft.documents[index];
      sceneSetupDraft.documents.splice(index, 1);
      if (removed?.type === sceneSetupDraft.mainDocType) {
        sceneSetupDraft.mainDocType = sceneSetupDraft.documents[0]?.type || '';
      }
      applySceneSetupAggregate();
      sceneSetupDraft.docFieldLinks = normalizeDocFieldLinks(
        sceneSetupDraft.docFieldLinks,
        sceneSetupDraft.documents,
      );
      if (removed?.type) delete sceneSetupDraft.aggregateRuleSettings[removed.type];
      if (removed?.type) delete sceneSetupAggregateDetailOpen[removed.type];
      ensureSceneSetupAggregateRuleSettings();
      clearSceneSetupLinkCheckDisplay();
    }

    function getSceneSetupFieldOptions(docType) {
      return getDocSchema(docType).fields || [];
    }

    function addDocFieldLink() {
      const docs = sceneSetupDraft.documents;
      if (docs.length < 2) {
        ElementPlus.ElMessage.warning('関連帳票を2件以上追加してください');
        return;
      }
      const sourceDocType = sceneSetupDraft.mainDocType || docs[0].type;
      const targetDoc = docs.find((d) => d.type !== sourceDocType) || docs[1];
      const sourceField = getDocSchema(sourceDocType).fields?.[0] || '';
      const targetField = getDocSchema(targetDoc.type).fields?.[0] || '';
      sceneSetupDraft.docFieldLinks.push({
        id: `link-${Date.now()}`,
        sourceDocType,
        sourceField,
        targetDocType: targetDoc.type,
        targetField,
      });
    }

    function removeDocFieldLink(index) {
      sceneSetupDraft.docFieldLinks.splice(index, 1);
    }

    function autoMatchDocFieldLinks() {
      if (sceneSetupDraft.documents.length < 2) {
        ElementPlus.ElMessage.warning('関連帳票を2件以上追加してください');
        return;
      }
      applySceneSetupAggregate();
      sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
        sceneSetupDraft.documents,
        sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
      );
      ensureSceneSetupAggregateRuleSettings();
      ElementPlus.ElMessage.success('同名フィールドを自動関連付けしました');
    }

    function normalizeSceneSetupAggregateRuleSettings(raw) {
      const settings = raw && typeof raw === 'object' ? cloneJson(raw) : {};
      Object.keys(settings).forEach((docType) => {
        settings[docType] = {
          strategy: settings[docType]?.strategy || 'priority',
          minMatches: Number(settings[docType]?.minMatches || 2),
          fallback: settings[docType]?.fallback || 'hitl',
        };
      });
      return settings;
    }

    function ensureSceneSetupAggregateRuleSettings() {
      if (!sceneSetupDraft.aggregateRuleSettings || typeof sceneSetupDraft.aggregateRuleSettings !== 'object') {
        sceneSetupDraft.aggregateRuleSettings = {};
      }
      Object.keys(sceneSetupDraft.aggregateRuleSettings).forEach((docType) => {
        delete sceneSetupDraft.aggregateRuleSettings[docType];
      });
    }

    function isSceneSetupAggregateDetailOpen(group) {
      if (!group?.docType) return false;
      if (sceneSetupAggregateDetailOpen[group.docType] === true) return true;
      if (sceneSetupAggregateDetailOpen[group.docType] === false) return false;
      return group.status === 'missing';
    }

    function toggleSceneSetupAggregateDetail(docType) {
      if (!docType) return;
      const group = sceneSetupAggregateRuleGroups.value.find((item) => item.docType === docType);
      sceneSetupAggregateDetailOpen[docType] = !isSceneSetupAggregateDetailOpen(group);
    }

    function isSceneSetupLinkBetweenMainAndDoc(link, docType) {
      const mainDocType = sceneSetupDraft.mainDocType;
      if (!mainDocType || !docType || !link) return false;
      return (link.sourceDocType === mainDocType && link.targetDocType === docType)
        || (link.targetDocType === mainDocType && link.sourceDocType === docType);
    }

    function getSceneSetupLinkMainField(link) {
      if (!link) return '';
      return link.sourceDocType === sceneSetupDraft.mainDocType ? link.sourceField : link.targetField;
    }

    function getSceneSetupLinkRelatedField(link, docType) {
      if (!link) return '';
      return link.sourceDocType === docType ? link.sourceField : link.targetField;
    }

    function updateSceneSetupAggregateLink(link, docType, side, value) {
      if (!link || !docType || !sceneSetupDraft.mainDocType) return;
      link.sourceDocType = sceneSetupDraft.mainDocType;
      link.targetDocType = docType;
      if (side === 'main') link.sourceField = value;
      if (side === 'related') link.targetField = value;
      clearSceneSetupLinkCheckDisplay();
    }

    function addSceneSetupAggregateLink(docType) {
      if (!sceneSetupDraft.mainDocType || !docType) return;
      const mainFields = getSceneSetupFieldOptions(sceneSetupDraft.mainDocType);
      const relatedFields = getSceneSetupFieldOptions(docType);
      const shared = mainFields.find((field) => relatedFields.includes(field));
      sceneSetupAggregateDetailOpen[docType] = true;
      sceneSetupDraft.docFieldLinks.push({
        id: `link-${sceneSetupDraft.mainDocType}-${docType}-${Date.now()}`,
        sourceDocType: sceneSetupDraft.mainDocType,
        sourceField: shared || mainFields[0] || '',
        targetDocType: docType,
        targetField: shared || relatedFields[0] || '',
      });
      clearSceneSetupLinkCheckDisplay();
    }

    function removeSceneSetupAggregateLink(link) {
      const idx = sceneSetupDraft.docFieldLinks.findIndex((item) => item === link || item.id === link?.id);
      if (idx >= 0) sceneSetupDraft.docFieldLinks.splice(idx, 1);
      clearSceneSetupLinkCheckDisplay();
    }

    function getSceneMatchingLabel(value, options) {
      return options.find((opt) => opt.value === value)?.label || '—';
    }

    function startRenameScene(scene) {
      renamingSceneId.value = scene.id;
    }

    function finishRenameScene(scene) {
      if (!scene) return;
      const trimmed = (scene.name || '').trim() || '新規シーン';
      scene.name = trimmed;
      if (currentSceneId.value === scene.id) {
        form.scene.name = trimmed;
        saveStorage(scene.id, form);
      } else {
        const stored = loadSceneFromStorage(scene.id);
        if (stored) {
          stored.scene.name = trimmed;
          saveStorage(scene.id, stored);
        }
      }
      if (renamingSceneId.value === scene.id) {
        renamingSceneId.value = null;
      }
    }

    function confirmRemoveSelectedWorkflowNode() {
      if (!assertWorkflowTopologyEditable()) return;
      const id = selectedWorkflowNodeId.value;
      if (!id) return;
      const node = getActiveWf()?.nodes?.find((n) => n.id === id);
      if (!node) return;
      if (node.type === 'start' || node.type === 'end' || node.isStart) {
        ElementPlus.ElMessage.warning('開始 / 終了ノードは削除できません。Workflow の端点として固定されています。');
        return;
      }
      const name = `${getWorkflowNodeMeta(node.type).title} · ${formatWfNodeLabel(node.label)}`;
      ElementPlus.ElMessageBox.confirm(
        `「${name}」を削除しますか？関連する接続も削除されます。`,
        'ノード削除',
        { confirmButtonText: '削除', cancelButtonText: 'キャンセル', type: 'warning' },
      ).then(() => {
        removeWorkflowNode(id);
        pushWorkflowHistory('ノードを削除');
        ElementPlus.ElMessage.success('ノードを削除しました');
      }).catch(() => {});
    }

    function onWfKeyDown(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoWorkflow();
        else undoWorkflow();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedWorkflowNodeId.value) {
          event.preventDefault();
          confirmRemoveSelectedWorkflowNode();
        } else if (selectedWorkflowEdgeKey.value) {
          if (!assertWorkflowTopologyEditable()) return;
          event.preventDefault();
          removeSelectedWorkflowEdge();
        }
        return;
      }
      if (!mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openWfNodePickerFromShortcut();
      }
    }

    function getWorkflowPortPosition(node, branch) {
      const summary = getWorkflowNodeCanvasSummary(node);
      const size = getWorkflowNodeDisplaySize(node, summary);
      const PORT = 6;
      if (node?.type === 'decision' && branch) {
        const branches = getDecisionNodeBranches(node);
        const match = branches.find((b) => b.key === branch);
        const ratio = match?.ratio ?? 0.5;
        return { x: node.x + size.w + PORT, y: node.y + size.h * ratio };
      }
      return { x: node.x + size.w + PORT, y: node.y + size.h / 2 };
    }

    function getDecisionPortStyle(node, branch) {
      const branches = getDecisionNodeBranches(node);
      const match = branches.find((b) => b.key === branch);
      const ratio = match?.ratio ?? 0.5;
      return {
        top: `${Math.round(ratio * 1000) / 10}%`,
        transform: 'translateY(-50%)',
      };
    }

    function getDecisionPortLabelStyle(node, branch) {
      const branches = getDecisionNodeBranches(node);
      const match = branches.find((b) => b.key === branch);
      const ratio = match?.ratio ?? 0.5;
      return {
        top: `calc(${Math.round(ratio * 1000) / 10}% - 8px)`,
      };
    }

    const wfConnectPreviewPath = computed(() => {
      if (!wfConnectDrag.active || !wfConnectDrag.fromId) return '';
      const from = (getActiveWf()?.nodes || []).find((n) => n.id === wfConnectDrag.fromId);
      if (!from) return '';
      const start = getWorkflowPortPosition(from, wfConnectDrag.branch);
      let end = screenToWorkflowCoords(wfConnectDrag.clientX, wfConnectDrag.clientY);
      const hoverId = wfConnectHoverTargetId.value;
      if (hoverId && hoverId !== wfConnectDrag.fromId) {
        const target = (getActiveWf()?.nodes || []).find((n) => n.id === hoverId);
        if (target) {
          const tasks = getWorkflowNodeActiveTasks(target);
          const size = getWorkflowNodeSize(target, tasks.length, tasks);
          end = { x: target.x - 6, y: target.y + size.h / 2 };
        }
      }
      return wfBezierPath(start.x, start.y, end.x, end.y);
    });

    function syncCurrentNodeFromWorkflow(node) {
      const map = {
        input: 'input',
        preprocess: 'image',
        ocr: 'ocr',
        hitl_gate: 'hitl_gate',
        ocr_confirm: 'hitl_gate',
        confirm: 'hitl_gate',
        verify_confirm: 'hitl_gate',
        ai_verify: 'verify',
        fraud_detect: 'fraud_detect',
        data_mapping: 'master',
        master_match: 'master',
        output: 'output',
      };
      if (node && map[node.type]) currentNode.value = map[node.type];
    }

    function toggleSceneSidebar() {
      sceneSidebarCollapsed.value = !sceneSidebarCollapsed.value;
    }

    function toggleLibraryPanel() {
      libraryPanelCollapsed.value = !libraryPanelCollapsed.value;
    }

    function enterWorkflowCanvasView() {
      appNavCollapsed.value = true;
      sceneSidebarCollapsed.value = true;
    }

    function toggleInspectorPanel() {
      inspectorPanelCollapsed.value = !inspectorPanelCollapsed.value;
      if (inspectorPanelCollapsed.value) {
        inspectorExpanded.value = false;
        restoreSceneSidebarAfterEditor();
      }
      if (!inspectorPanelCollapsed.value) {
        if (!selectedWorkflowNodeId.value && !selectedWorkflowEdgeKey.value) {
          inspectorMode.value = 'overview';
        }
      }
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_STORAGE_KEY, inspectorPanelCollapsed.value ? '1' : '0');
      } catch (e) { /* ignore */ }
    }

    function onInspectorResizeStart(event) {
      if (inspectorPanelCollapsed.value) return;
      event.preventDefault();
      inspectorResizing.value = true;
      document.body.classList.add('idp-inspector-resizing');
      const startX = event.clientX;
      const startWidth = inspectorPanelWidth.value;

      function onMove(e) {
        const next = Math.min(
          INSPECTOR_WIDTH_MAX,
          Math.max(INSPECTOR_WIDTH_MIN, startWidth + (startX - e.clientX)),
        );
        inspectorPanelWidth.value = next;
      }

      function onUp() {
        inspectorResizing.value = false;
        document.body.classList.remove('idp-inspector-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        try {
          localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorPanelWidth.value));
        } catch (e) { /* ignore */ }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function selectWorkflowNode(id) {
      selectedWorkflowEdgeKey.value = null;
      wfConnectSourceId.value = null;
      inspectorExpanded.value = false;
      restoreSceneSidebarAfterEditor();
      const pickedNode = getActiveWf()?.nodes?.find((n) => n.id === id);
      selectedWorkflowNodeId.value = id;
      openWorkflowInspector('node');
      if (pickedNode?.type === 'end') {
        Object.assign(pickedNode, normalizeEndNode(pickedNode));
      } else if (pickedNode?.type === 'start') {
        Object.assign(pickedNode, normalizeStartNode(pickedNode));
      } else if (pickedNode?.type === 'decision') Object.assign(pickedNode, normalizeDecisionNode(pickedNode, getActiveWf()));
      else if (pickedNode?.type === 'notify') Object.assign(pickedNode, normalizeNotifyNode(pickedNode));
      else if (pickedNode?.type === 'code') Object.assign(pickedNode, normalizeCodeNode(pickedNode, getActiveWf()));
      else if (pickedNode && isHitlGateNode(pickedNode)) Object.assign(pickedNode, normalizeHitlGateNode(pickedNode));
      if (pickedNode && (pickedNode.type === 'decision' || isHitlGateNode(pickedNode))) {
        syncWorkflowYesExpression(pickedNode, sceneDocTypes.value);
      }
      syncCurrentNodeFromWorkflow(pickedNode);
    }

    function getNodeMainOutTargetId(nodeId) {
      const edge = (getActiveWf()?.edges || []).find((e) => e.from === nodeId && !e.branch);
      return edge?.to || '';
    }

    function setNodeMainOutTarget(nodeId, targetNodeId) {
      if (!assertWorkflowTopologyEditable()) return;
      const wf = getActiveWf();
      if (!wf || !nodeId) return;
      wf.edges = wf.edges.filter((e) => !(e.from === nodeId && !e.branch));
      if (targetNodeId) {
        wf.edges.push({ from: nodeId, to: targetNodeId });
      }
      pushWorkflowHistory('接続先を変更');
    }

    function isConnectModeSource(nodeId) {
      return isWorkflowTopologyEditable.value && wfConnectSourceId.value === nodeId;
    }

    function selectWorkflowEdge(edge) {
      if (!edge) return;
      closeWfNodePicker();
      wfConnectSourceId.value = null;
      selectedWorkflowEdgeKey.value = workflowEdgeKey(edge);
      selectedWorkflowNodeId.value = null;
      syncCurrentNodeFromWorkflow(null);
      openWorkflowInspector('edge');
    }

    function removeSelectedWorkflowEdge() {
      if (!assertWorkflowTopologyEditable()) return;
      if (!selectedWorkflowEdgeKey.value) return;
      getActiveWf().edges = (getActiveWf().edges || []).filter(
        (e) => workflowEdgeKey(e) !== selectedWorkflowEdgeKey.value,
      );
      selectedWorkflowEdgeKey.value = null;
      closeWorkflowInspector();
      syncCurrentNodeFromWorkflow(null);
      pushWorkflowHistory('接続を削除');
      ElementPlus.ElMessage.info('接続を削除しました');
    }

    function connectWorkflowEdge(fromId, toId, branch) {
      const wf = getActiveWf();
      const from = wf.nodes.find((n) => n.id === fromId);
      const to = wf.nodes.find((n) => n.id === toId);
      if (!from || !to || fromId === toId) return false;
      if (from.type === 'decision') {
        if (!branch) return false;
        wf.edges = wf.edges.filter((e) => !(e.from === fromId && e.branch === branch));
        wf.edges.push({
          from: fromId,
          to: toId,
          branch,
          label: getDecisionBranchEdgeLabel(branch, from),
        });
      } else {
        wf.edges = wf.edges.filter((e) => !(e.from === fromId && !e.branch));
        wf.edges.push({ from: fromId, to: toId });
      }
      return true;
    }

    function onWfNodeAddOutClick(node, event) {
      if (wfConnectSuppressClick) return;
      openWfNodePicker(node, event, 'after');
    }

    function onWfNodeAddInClick(node, event) {
      if (wfConnectSuppressClick) return;
      openWfNodePicker(node, event, 'before');
    }

    function onWfConnectHandleDown(event, node, branch, role = 'out') {
      if (!assertWorkflowTopologyEditable()) return;
      if (role === 'in') return;
      event.stopPropagation();

      const anchorEl = event.currentTarget;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;

      wfConnectDrag.fromId = node.id;
      wfConnectDrag.branch = branch;
      wfConnectDrag.clientX = startX;
      wfConnectDrag.clientY = startY;
      wfConnectDrag.active = false;
      wfConnectHoverTargetId.value = null;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          dragging = true;
          wfConnectDrag.active = true;
          document.body.classList.add('wf-connecting');
        }
        if (!dragging) return;
        wfConnectDrag.clientX = ev.clientX;
        wfConnectDrag.clientY = ev.clientY;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const inPort = hit?.closest?.('[data-wf-port="in"]');
        const targetId = inPort?.getAttribute('data-node-id');
        wfConnectHoverTargetId.value = targetId && targetId !== node.id ? targetId : null;
      };

      const onUp = (ev) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('wf-connecting');
        wfConnectDrag.active = false;

        if (!dragging) {
          if (role === 'branch') openWfNodePickerForDecisionBranch(node, branch, anchorEl);
          else if (role === 'out') openWfNodePicker(node, anchorEl, 'after');
          wfConnectSuppressClick = true;
          setTimeout(() => { wfConnectSuppressClick = false; }, 0);
          wfConnectDrag.fromId = null;
          wfConnectDrag.branch = null;
          wfConnectHoverTargetId.value = null;
          return;
        }

        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const inPort = hit?.closest?.('[data-wf-port="in"]');
        const targetId = inPort?.getAttribute('data-node-id');
        if (targetId && wfConnectDrag.fromId && connectWorkflowEdge(wfConnectDrag.fromId, targetId, wfConnectDrag.branch)) {
          pushWorkflowHistory('接続を追加');
          ElementPlus.ElMessage.success('接続しました');
          wfConnectSuppressClick = true;
          setTimeout(() => { wfConnectSuppressClick = false; }, 0);
        }
        wfConnectDrag.fromId = null;
        wfConnectDrag.branch = null;
        wfConnectHoverTargetId.value = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function removeWorkflowNode(id) {
      const wf = getActiveWf();
      if (!wf) return;
      wf.nodes = wf.nodes.filter((n) => n.id !== id);
      wf.edges = wf.edges.filter((e) => e.from !== id && e.to !== id);
      if (selectedWorkflowNodeId.value === id) {
        selectedWorkflowNodeId.value = wf.nodes[0]?.id || null;
        if (selectedWorkflowNodeId.value) {
          syncCurrentNodeFromWorkflow(wf.nodes.find((n) => n.id === selectedWorkflowNodeId.value));
        } else {
          inspectorMode.value = 'scene';
        }
      }
      selectedWorkflowEdgeKey.value = null;
    }

    function openSceneInspector() {
      inspectorMode.value = 'scene';
      selectedWorkflowNodeId.value = null;
      selectedWorkflowEdgeKey.value = null;
      currentNode.value = 'scene';
    }

    function onWfLibraryDragStart(event, type) {
      wfLibraryDrag.type = type;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', type);
    }

    function onWfCanvasDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = wfLibraryDrag.type ? 'copy' : 'none';
    }

    function onWfCanvasDrop(event) {
      event.preventDefault();
      if (!assertWorkflowTopologyEditable()) return;
      if (!wfLibraryDrag.type) return;
      const pos = screenToWorkflowCoords(event.clientX, event.clientY);
      const type = wfLibraryDrag.type;
      wfLibraryDrag.type = null;
      if (canReuseWorkflowNodeType(type) && nodeReuseSceneOptions.value.length) {
        openNodeReuseDialog(
          { kind: 'process', type, label: getWorkflowNodeMeta(type).title },
          { mode: 'canvas', x: pos.x - 120, y: pos.y - 36 },
        );
        return;
      }
      createWorkflowNodeAt(type, pos.x - 120, pos.y - 36);
    }

    function onWfNodePointerDown(event, node) {
      if (event.button !== 0) return;
      if (!isWorkflowTopologyEditable.value) return;
      event.preventDefault();
      wfNodeDrag.id = node.id;
      wfNodeDrag.startX = event.clientX;
      wfNodeDrag.startY = event.clientY;
      wfNodeDrag.originX = node.x;
      wfNodeDrag.originY = node.y;
      const onMove = (ev) => {
        const target = getActiveWf().nodes.find((n) => n.id === wfNodeDrag.id);
        if (!target) return;
        target.x = Math.max(8, wfNodeDrag.originX + (ev.clientX - wfNodeDrag.startX) / wfViewport.scale);
        target.y = Math.max(8, wfNodeDrag.originY + (ev.clientY - wfNodeDrag.startY) / wfViewport.scale);
      };
      const onUp = () => {
        const target = getActiveWf().nodes.find((n) => n.id === wfNodeDrag.id);
        const moved = target && (
          Math.abs(target.x - wfNodeDrag.originX) > 1
          || Math.abs(target.y - wfNodeDrag.originY) > 1
        );
        wfNodeDrag.id = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (moved) pushWorkflowHistory('ノード位置を移動');
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function onDecisionConditionTypeChange(typeValue) {
      onJudgmentContextChange(typeValue);
    }

    function onDecisionCustomExpressionChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision' || node.conditionType !== 'custom') return;
      node.yesRule = node.yesExpression || '';
      syncDecisionYesRuleToCases(node);
      pushWorkflowHistory('IF 条件を変更');
    }

    function onDecisionGatewayTypeChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      if (node.gatewayType === 'pass') {
        node.yesRule = node.yesRule || '評価のみ記録し、常に次工程へ進む';
        node.noRule = node.noRule || '—';
      }
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('判断タイプを変更');
    }

    function onDecisionThresholdChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('閾値を変更');
    }

    function syncDecisionYesRuleToCases(node) {
      if (!node?.cases?.length) return;
      const cond = node.cases[0]?.conditions?.[0];
      if (cond) {
        cond.value = node.yesRule || '';
        cond.expression = node.yesExpression || '';
      }
    }

    function onDecisionYesRuleChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      syncDecisionYesRuleToCases(node);
      pushWorkflowHistory('YES 判断条件を変更');
    }

    function onDecisionNoRuleChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      node.elseDescription = node.noRule || '';
      pushWorkflowHistory('NO 結果を変更');
    }

    function onHitlGateYesRuleChange() {
      syncWorkflowYesExpression(selectedWorkflowNode.value, sceneDocTypes.value);
      pushWorkflowHistory('発生条件を変更');
    }

    function onHitlGateNoRuleChange() {
      pushWorkflowHistory('スキップ結果を変更');
    }

    function onDecisionConditionLogicChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'decision') return;
      syncWorkflowYesExpression(node, sceneDocTypes.value);
      pushWorkflowHistory('条件ロジックを変更');
    }

    function onDecisionGatewayPolicyChange() {
      pushWorkflowHistory('ゲートウェイ方針を変更');
    }

    function decisionReturnTargetOptions(nodeId) {
      const wf = getActiveWf();
      if (!wf || !nodeId) return [];
      const self = wf.nodes.find((n) => n.id === nodeId);
      if (!self) return [];
      return wf.nodes
        .filter((n) => n.id !== nodeId && n.x <= self.x + 20)
        .map((n) => ({
          value: n.id,
          label: `${getWorkflowNodeMeta(n.type).title} · ${formatWfNodeLabel(n.label)}`,
        }));
    }

    function getDecisionThresholdLabel(node) {
      if (node?.conditionType === 'ocr_hitl') return '信頼度閾値 (%)';
      if (node?.conditionType === 'preprocess_hitl') return '最小解像度 (DPI)';
      return '閾値';
    }

    function getDecisionThresholdRange(node) {
      if (node?.conditionType === 'ocr_hitl') return { min: 0, max: 100 };
      if (node?.conditionType === 'preprocess_hitl') return { min: 72, max: 600 };
      return { min: 0, max: 100 };
    }

    function workflowYesExpressionNote(node) {
      if (!node) return '';
      const rule = (node.yesRule || '').trim();
      if (!rule || /\{\{[^}]+\}\}/.test(rule)) return '';
      if (compileNaturalToExpression(rule, sceneDocTypes.value)) return '';
      if (DECISION_PRESET_EXPRESSION[node.conditionType]) {
        return '自然言語を実行式に自動変換できません。✦ AI補助 を実行するか、プリセット既定のエンジン判定を使用します';
      }
      return '自然言語を実行式に自動変換できません。✦ AI補助 を実行するか、帳票名・フィールドを明確に記述してください';
    }

    function addDecisionElifCase(node) {
      if (!node?.cases) return;
      node.cases.push(createDecisionCase('elif'));
      pushWorkflowHistory('ELIF を追加');
    }

    function removeDecisionCase(node, caseId) {
      if (!node?.cases || caseId === 'if') return;
      node.cases = node.cases.filter((c) => c.id !== caseId);
      const wf = getActiveWf();
      if (wf) {
        wf.edges = wf.edges.filter((e) => !(e.from === node.id && e.branch === caseId));
      }
      pushWorkflowHistory('分岐 CASE を削除');
    }

    const decisionVariableOptions = computed(() => {
      const wf = getActiveWf();
      const nodeId = selectedWorkflowNodeId.value;
      if (!wf || !nodeId) return [];
      return getDecisionVariableOptions(wf, nodeId, form.verify);
    });

    const decisionVariableOptionGroups = computed(() =>
      getDecisionVariableOptionGroups(decisionVariableOptions.value));

    function formatDecisionVariableCascaderLabel(option) {
      const raw = option?.label || option?.value || '';
      return raw
        .replace(/\s*·\s*\{[^}]+\}\s*$/u, '')
        .replace(/^\s*[^·]+?\s*·\s*/u, '')
        .trim() || raw;
    }

    const decisionVariableCascaderOptions = computed(() =>
      decisionVariableOptionGroups.value.map((group) => ({
        id: `node:${group.label}`,
        text: group.label,
        items: group.options.map((opt) => ({
          id: opt.value,
          text: formatDecisionVariableCascaderLabel(opt),
        })),
      })));

    function judgmentAllowsElif(node) {
      return !!node && node.type === 'decision';
    }

    function previewDecisionCase(node, decisionCase) {
      return getDecisionCaseCanvasPreview(node, decisionCase);
    }

    function previewDecisionNode(node) {
      if (!node) return '条件未設定';
      const options = getDecisionVariableOptions(getActiveWf(), node.id);
      return getDecisionConditionDisplay(node, sceneDocTypes.value, options);
    }

    function onDecisionConditionFieldChange() {
      pushWorkflowHistory('IF/ELSE 条件を変更');
    }

    function addDecisionCondition(node, caseId) {
      const decisionCase = node?.cases?.find((c) => c.id === caseId);
      if (!decisionCase) return;
      decisionCase.conditions.push(createDecisionCondition());
      pushWorkflowHistory('条件を追加');
    }

    function removeDecisionCondition(node, caseId, conditionId) {
      const decisionCase = node?.cases?.find((c) => c.id === caseId);
      if (!decisionCase || decisionCase.conditions.length <= 1) return;
      decisionCase.conditions = decisionCase.conditions.filter((c) => c.id !== conditionId);
      pushWorkflowHistory('条件を削除');
    }

    function getDecisionCaseKindLabel(decisionCase, index) {
      if (decisionCase?.label) return decisionCase.label;
      if (decisionCase?.kind === 'if' || index === 0) return 'IF';
      return 'ELIF';
    }

    function formatHitlActionsLabel(actions) {
      const list = normalizeHitlGateActions(actions);
      return list.map((v) => HITL_ACTION_OPTIONS.find((o) => o.value === v)?.label || v).join('/');
    }

    function getDecisionBranchTarget(nodeId, branch) {
      const edge = (getActiveWf()?.edges || []).find((e) => e.from === nodeId && e.branch === branch);
      if (!edge) return '—';
      const target = (getActiveWf()?.nodes || []).find((n) => n.id === edge.to);
      return target?.label?.replace(/\n/g, ' ') || edge.to;
    }

    function getDecisionBranchTargetId(nodeId, branch) {
      const edge = (getActiveWf()?.edges || []).find((e) => e.from === nodeId && e.branch === branch);
      return edge?.to || '';
    }

    function setDecisionBranchTarget(nodeId, branch, targetNodeId) {
      if (!assertWorkflowTopologyEditable()) return;
      const wf = getActiveWf();
      if (!wf || !nodeId || !branch) return;
      wf.edges = wf.edges.filter((e) => !(e.from === nodeId && e.branch === branch));
      if (targetNodeId) {
        wf.edges.push({
          from: nodeId,
          to: targetNodeId,
          branch,
          label: getDecisionBranchEdgeLabel(branch, wf.nodes.find((n) => n.id === nodeId)),
        });
      }
      pushWorkflowHistory('分岐接続先を変更');
    }

    function getWorkflowNodeActiveTasks(node) {
      if (!node || isWorkflowTerminalNode(node)) return [];
      switch (node.type) {
        case 'preprocess': {
          const img = processingForm.value?.image || {};
          const docCount = (key) => {
            const types = img[key];
            return Array.isArray(types) && types.length ? types.length : 0;
          };
          const tasks = [];
          if (img.rotate) {
            const n = docCount('rotateDocTypes');
            tasks.push(n ? `回転 ${n}件` : '画像回転');
          }
          if (img.perspective) {
            const n = docCount('perspectiveDocTypes');
            tasks.push(n ? `補正 ${n}件` : '画像補正');
          }
          if (img.split) {
            const n = docCount('splitDocTypes');
            tasks.push(n ? `分割 ${n}件` : '帳票分割');
          }
          if (img.sort) {
            const n = docCount('sortDocTypes');
            tasks.push(n ? `排序 ${n}件` : '画像排序');
          }
          return tasks.length ? tasks : ['前処理'];
        }
        case 'input': {
          const channels = form.processing?.input?.channels || [];
          return channels.map((c) => getInputChannelLabel(c));
        }
        case 'ocr': {
          const docs = form.scene?.documents || [];
          const enabled = (form.processing?.ocrExtract?.enabledTypes || [])
            .filter((t) => docs.some((d) => d.type === t));
          if (!enabled.length) return ['OCR抽出'];
          return enabled.map((t) => getDocDisplayLabel(t));
        }
        case 'hitl_gate':
        case 'confirm':
        case 'ocr_confirm':
        case 'verify_confirm': {
          const meta = getHitlGatePreset(node);
          const tags = [];
          if (meta) tags.push(meta.label);
          if (node.role) tags.push(node.role);
          return tags.length ? tags : ['人工確認'];
        }
        case 'notify': {
          const normalized = normalizeNotifyNode(node);
          const tpl = NOTIFY_TEMPLATES.find((t) => t.value === normalized.template);
          const ch = NOTIFY_CHANNELS.find((c) => c.value === normalized.channel);
          const tags = [tpl?.label || '通知'];
          if (normalized.supplementEventEnabled) tags.push('補件待ち');
          if (ch) tags.push(ch.label);
          const dest = truncateWorkflowPreview(normalized.recipients, 24);
          if (dest) tags.push(dest);
          return tags;
        }
        case 'code': {
          const normalized = normalizeCodeNode(node, getActiveWf());
          const tags = ['Python'];
          const inCount = normalized.inputs?.filter((r) => r.variable)?.length || 0;
          if (inCount) tags.push(`入参 ${inCount}`);
          const lines = String(normalized.pythonCode || '').split('\n').length;
          tags.push(`${lines}行`);
          return tags;
        }
        case 'decision': {
          const tags = [];
          (node.cases || []).forEach((c, i) => {
            if (c.label) {
              tags.push(c.label);
              return;
            }
            const preview = getDecisionCaseCanvasPreview(node, c);
            tags.push(preview && preview !== '条件未設定' ? preview : (i === 0 ? 'IF' : 'ELIF'));
          });
          if (node.elseLabel) tags.push(`ELSE:${node.elseLabel}`);
          return tags.length ? tags : ['条件分岐'];
        }
        case 'master_match': {
          const rules = node.matchRules || [];
          if (!rules.length) return ['未設定'];
          return [`照合 ${rules.length}件`];
        }
        case 'data_mapping': {
          const rules = node.mappingRules || [];
          const mapped = rules.filter((r) => r.sourceFieldIds?.length && r.standardFieldId).length;
          const conflictOn = rules.filter((r) => r.conflictCheckEnabled).length;
          const tags = [`標準項目 ${mapped}/${rules.length}`];
          if (conflictOn) tags.push(`競合検出 ${conflictOn}`);
          const unmapped = rules.length - mapped;
          if (unmapped) tags.push(`未設定 ${unmapped}`);
          return tags;
        }
        case 'ai_verify': {
          const tags = [];
          if (form.verify?.textEnabled && form.verify?.text?.length) tags.push('テキスト');
          if (form.verify?.dataEnabled && form.verify?.dataRules?.length) tags.push('データ');
          if (form.verify?.completenessEnabled) tags.push('完全性');
          if (form.verify?.sealEnabled) tags.push('印鑑');
          return tags;
        }
        case 'fraud_detect': {
          const cfg = normalizeFraudDetectConfig(form.processing?.fraudDetect);
          const docs = cfg.targetDocTypes?.length
            ? cfg.targetDocTypes.map((t) => getDocDisplayLabel(t)).slice(0, 2)
            : ['全帳票'];
          return [...docs, FRAUD_DETECT_PS_CATEGORY.label, `閾値 ${cfg.riskThreshold}`];
        }
        case 'output': {
          const method = form.output?.deliveryMethod === 'shared_folder' ? '共有フォルダ' : 'API';
          return [`${method} → ${form.output?.outputTarget || OUTPUT_TARGET_DEFAULT}`];
        }
        case 'scene_aggregate': {
          const mainDoc = getSceneMainDocType(form.scene);
          const tags = [];
          if (mainDoc) tags.push(`主帳票: ${getDocDisplayLabel(mainDoc)}`);
          const docs = form.scene?.documents || [];
          if (docs.length) tags.push(`帳票 ${docs.length}件`);
          return tags;
        }
        case 'scene_completeness': {
          const docs = form.scene?.documents || [];
          if (!docs.length) return ['帳票未設定'];
          return docs.map((d) => `${getDocDisplayLabel(d.type)}(${d.submission})`);
        }
        default:
          return getWorkflowNodeMeta(node.type).tasks || [];
      }
    }

    function joinWorkflowSummary(...parts) {
      return parts.filter((p) => p != null && String(p).trim()).join(' · ');
    }

    function getWorkflowNodeCanvasSummary(node) {
      if (!node || isWorkflowTerminalNode(node)) return '';
      const reusePrefix = node.reuseReview
        ? `${node.reuseStatus === 'ready' ? 'コピー済' : '要確認'}: ${truncateWorkflowPreview(node.reuseSourceSceneName || node.reuseReview.sourceSceneName, 10)}`
        : '';
      switch (node.type) {
        case 'preprocess': {
          const tasks = getWorkflowNodeActiveTasks(node);
          if (!tasks.length) return '未設定';
          return joinWorkflowSummary(reusePrefix, `${tasks.length}件有効`, tasks.slice(0, 2).join('·'));
        }
        case 'ocr': {
          const tasks = getWorkflowNodeActiveTasks(node);
          const enabledItems = ocrExtractItems.value.filter((item) => item.enabled);
          const mergeCount = enabledItems.filter((item) => item.mergeSameType).length;
          const separateCount = enabledItems.length - mergeCount;
          let mergeTag = null;
          if (mergeCount && separateCount) mergeTag = '混在';
          else if (mergeCount) mergeTag = '統合ON';
          else if (separateCount) mergeTag = 'ファイル別';
          return joinWorkflowSummary(
            reusePrefix,
            tasks.length ? `${tasks.length}帳票` : '未設定',
            mergeTag,
          );
        }
        case 'data_mapping': {
          const rules = node.mappingRules || [];
          const mapped = rules.filter((r) => r.sourceFieldIds?.length && r.standardFieldId).length;
          const conflictOn = rules.filter((r) => r.conflictCheckEnabled).length;
          const unmapped = rules.length - mapped;
          return joinWorkflowSummary(
            reusePrefix,
            rules.length ? `${mapped}/${rules.length}` : '未設定',
            conflictOn ? `競合${conflictOn}` : (unmapped ? `未設定${unmapped}` : null),
          );
        }
        case 'ai_verify': {
          const parts = [];
          if (form.verify?.completenessEnabled) parts.push('完全性');
          const textN = form.verify?.text?.length || 0;
          if (form.verify?.textEnabled) parts.push(textN ? `テキスト${textN}` : 'テキスト');
          const dataN = form.verify?.dataRules?.length || 0;
          if (form.verify?.dataEnabled) parts.push(dataN ? `データ${dataN}` : 'データ');
          if (form.verify?.sealEnabled) {
            const sealN = countSealDocTypes(form.verify.seal?.rules);
            parts.push(sealN ? `印鑑${sealN}` : '印鑑');
          }
          return joinWorkflowSummary(reusePrefix, ...parts) || '未設定';
        }
        case 'master_match': {
          const rules = node.matchRules || [];
          const first = rules[0];
          const srcLabel = first ? getMasterSystemSourceLabel(first.masterSourceId) : '';
          const method = MASTER_MATCH_STRATEGIES.find((s) => s.value === node.matchMethod)?.label || '';
          return joinWorkflowSummary(
            reusePrefix,
            rules.length ? `照合${rules.length}` : '未設定',
            srcLabel ? truncateWorkflowPreview(srcLabel, 8) : null,
            method ? truncateWorkflowPreview(method, 4) : null,
          );
        }
        case 'decision': {
          const cases = node.cases || [];
          const first = cases[0];
          const head = first?.label
            || (first ? truncateWorkflowPreview(getDecisionCaseCanvasPreview(node, first), 12) : 'IF');
          return joinWorkflowSummary(head, `${cases.length + 1}分岐`);
        }
        case 'hitl_gate': {
          const meta = getHitlGatePreset(node);
          return joinWorkflowSummary(reusePrefix, meta?.label || '人工確認', node.role);
        }
        case 'notify': {
          const normalized = normalizeNotifyNode(node);
          const tpl = NOTIFY_TEMPLATES.find((t) => t.value === normalized.template);
          const ch = NOTIFY_CHANNELS.find((c) => c.value === normalized.channel);
          return joinWorkflowSummary(reusePrefix, tpl?.label, ch?.label);
        }
        case 'code': {
          const normalized = normalizeCodeNode(node, getActiveWf());
          const inCount = normalized.inputs?.filter((r) => r.variable)?.length || 0;
          return joinWorkflowSummary(reusePrefix, 'Python', inCount ? `入参${inCount}` : null);
        }
        default: {
          const tasks = getWorkflowNodeActiveTasks(node);
          return joinWorkflowSummary(reusePrefix, ...tasks.slice(0, 2));
        }
      }
    }


    function isPreprocessSettingOn(item) {
      if (item.alwaysOn) return true;
      if (!item.switchKey) return false;
      return !!processingForm.value?.image?.[item.switchKey];
    }

    function showPreprocessSettingDetail(item) {
      if (item.alwaysOn) return true;
      if (!item.detailType) return false;
      return isPreprocessSettingOn(item);
    }

    function formatWfNodeLabel(label) {
      return String(label || '').replace(/\n/g, ' ');
    }

    function getWorkflowNodeDisplayLabel(node) {
      if (!node) return '';
      return getWorkflowNodeMeta(node.type).title;
    }

    function workflowNodeSummaryTasks(summary) {
      if (!summary) return [];
      return Array.isArray(summary) ? summary : [summary];
    }

    function getWorkflowNodeStyle(node) {
      const summary = getWorkflowNodeCanvasSummary(node);
      const size = getWorkflowNodeDisplaySize(node, summary);
      return {
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${size.w}px`,
        minHeight: `${size.h}px`,
      };
    }

    function sealRuleDocTypes(rule) {
      if (Array.isArray(rule?.docTypes) && rule.docTypes.length) return rule.docTypes;
      if (rule?.docType) return [rule.docType];
      return [];
    }

    function countSealDocTypes(rules) {
      const set = new Set();
      (rules || []).forEach((rule) => {
        sealRuleDocTypes(rule).forEach((doc) => set.add(doc));
      });
      return set.size;
    }

    const knowledgeCatalog = computed(() => mergeKnowledgeCatalog(KNOWLEDGE_SOURCE_SEEDS, form.knowledgeSources || []));

    const externalApiConfig = computed(() => normalizeExternalApiConfig(form.processing.externalApi));

    const knowledgeQueryVariableOptions = computed(() => {
      const ocrOptions = (form.scene.documents || []).flatMap((doc) =>
        (getDocSchema(doc.type).fields || []).map((f) => ({
          value: `{{${doc.type}.${f}}}`,
          label: `${getDocDisplayLabel(doc.type)} · ${f}`,
        })));
      return [
        { value: '{{ocr.fields}}', label: 'OCR抽出フィールド（全体）' },
        { value: '{{case.primaryKey}}', label: '主キー値' },
        { value: '{{case.policyNo}}', label: '証券番号' },
        ...ocrOptions,
      ];
    });

    const masterMatchRules = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return [];
      const defaults = { matchMethod: node.matchMethod, masterSourceId: node.masterSourceId };
      return (node.matchRules || []).map((rule) => normalizeMasterMatchRule(rule, defaults));
    });

    const editingMasterMatchRuleId = ref(null);
    const masterMatchRuleDraft = reactive({
      name: '',
      inputKind: 'ocr',
      standardFieldId: '',
      docType: '',
      field: '',
      scope: 'instance',
      masterSourceId: 'dict:icd10',
      masterSheet: '',
      lookupField: '',
      outputFields: [],
      matchMethod: 'hybrid',
      returnMode: 'top1',
    });

    const masterMatchDraftFieldOptions = computed(() =>
      (masterMatchRuleDraft.docType ? getDocSchema(masterMatchRuleDraft.docType).fields : []));

    const masterMatchDraftSheetOptions = computed(() =>
      getMasterSourceSheetOptions(masterMatchRuleDraft.masterSourceId));

    const masterMatchDraftLookupOptions = computed(() =>
      getMasterSourceColumnOptions(masterMatchRuleDraft.masterSourceId));

    const masterMatchDraftOutputOptions = computed(() =>
      getMasterSourceOutputColumnOptions(masterMatchRuleDraft.masterSourceId, masterMatchRuleDraft.outputFields));

    const masterMatchDraftRequiresSheet = computed(() =>
      masterSourceRequiresSheet(masterMatchRuleDraft.masterSourceId));

    function masterMatchRuleInputSummary(rule) {
      const r = normalizeMasterMatchRule(rule);
      if (r.inputKind === 'standard') {
        const meta = DATA_MAPPING_STANDARD_FIELDS.find((f) => f.value === r.standardFieldId);
        return `標準: ${meta?.label || r.standardFieldId || r.field || '—'}`;
      }
      if (r.docType && r.field) {
        return `${getDocDisplayLabel(r.docType)} · ${r.field}`;
      }
      return '入力未設定';
    }

    function masterMatchRuleMatchMethodSummary(rule) {
      const r = normalizeMasterMatchRule(rule);
      return MASTER_MATCH_STRATEGIES.find((s) => s.value === r.matchMethod)?.label || '—';
    }

    function masterMatchRuleReturnModeSummary(rule) {
      const r = normalizeMasterMatchRule(rule);
      return MASTER_MATCH_RETURN_MODES.find((s) => s.value === r.returnMode)?.label || '—';
    }

    function masterMatchRuleMasterRefSummary(rule) {
      const r = normalizeMasterMatchRule(rule);
      const parts = [getMasterSystemSourceLabel(r.masterSourceId)];
      if (r.masterSheet) parts.push(r.masterSheet);
      if (r.lookupField) parts.push(r.lookupField);
      return parts.filter(Boolean).join(' · ') || '—';
    }

    function masterMatchRuleOutputSummary(rule) {
      const outs = normalizeMasterMatchRule(rule).outputFields || [];
      if (!outs.length) return '—';
      if (outs.length <= 2) return outs.join('、');
      return `${outs[0]} +${outs.length - 1}`;
    }

    function inferMasterSourceIdForLegacyRule(enriched) {
      const field = enriched.field || '';
      const lookup = enriched.lookupField || '';
      if (/医療機関|機関/.test(field) || /医療機関|機関/.test(lookup)) {
        return 'dict:medical_facility';
      }
      if (/薬|医薬|YJ/i.test(field)) return 'dict:drug_generic';
      if (/診療科/.test(field) || /診療科/.test(lookup)) return 'dict:diagnosis_dept';
      if (/傷病|診断|ICD/i.test(field) || /傷病|疾病/i.test(lookup)) return 'dict:icd10';
      const dictId = enriched.dictionaryId || 'icd10';
      return `dict:${dictId}`;
    }

    function masterMatchRuleFromLegacyMapping(rule, knowledgeSource) {
      const enriched = enrichMasterRule(rule, knowledgeSource);
      const stdField = DATA_MAPPING_STANDARD_FIELDS.find(
        (f) => f.label === enriched.field || f.value === enriched.field,
      );
      const masterSourceId = inferMasterSourceIdForLegacyRule(enriched);
      return normalizeMasterMatchRule({
        id: enriched.id,
        name: enriched.field,
        inputKind: stdField ? 'standard' : 'ocr',
        standardFieldId: stdField?.value || '',
        docType: enriched.docType,
        field: enriched.field,
        masterSourceId,
        lookupField: enriched.lookupField,
        outputFields: enriched.outputFields,
        matchMethod: 'hybrid',
        returnMode: 'top1',
      });
    }

    function repairMasterMatchRuleSources(node) {
      if (!node?.matchRules?.length) return;
      node.matchRules = node.matchRules.map((rule) => {
        const r = normalizeMasterMatchRule(rule, { matchMethod: node.matchMethod });
        const field = r.field || r.name || '';
        const expected = inferMasterSourceIdForLegacyRule({
          field,
          lookupField: r.lookupField,
          dictionaryId: r.masterSourceId?.replace(/^dict:/, ''),
        });
        if (r.masterSourceId === 'dict:icd10' && expected !== 'dict:icd10') {
          return normalizeMasterMatchRule({ ...r, masterSourceId: expected }, { matchMethod: node.matchMethod });
        }
        return r;
      });
    }

    function syncMasterMatchNodesFromSceneMaster() {
      const wf = getActiveWf();
      const ks = form.master?.knowledgeSource;
      (wf?.nodes || []).forEach((node) => {
        if (node.type !== 'master_match') return;
        const normalized = normalizeMasterMatchNode(node, wf);
        if (!normalized.matchRules?.length && form.master?.mappings?.length) {
          normalized.matchRules = form.master.mappings.map((rule) =>
            masterMatchRuleFromLegacyMapping(rule, ks),
          );
        }
        repairMasterMatchRuleSources(normalized);
        Object.assign(node, normalized);
      });
    }

    function resetMasterMatchRuleFields() {
      const src = getMasterSystemSource('dict:icd10');
      Object.assign(masterMatchRuleDraft, {
        name: '',
        inputKind: 'ocr',
        standardFieldId: DATA_MAPPING_STANDARD_FIELDS[0]?.value || '',
        docType: sceneDocTypes.value[0] || '',
        field: '',
        scope: 'instance',
        masterSourceId: 'dict:icd10',
        masterSheet: '',
        lookupField: src?.columns?.[0] || '',
        outputFields: [],
        matchMethod: 'hybrid',
        returnMode: 'top1',
      });
    }

    function resetMasterMatchRuleDraft() {
      editingMasterMatchRuleId.value = null;
      resetMasterMatchRuleFields();
    }

    function ensureDataMappingEditorReady() {
      if (inspectorPanel.value !== 'data_mapping' || !inspectorExpanded.value) return;
      const node = getActiveDataMappingNode();
      if (!node) return;
      const rules = node.mappingRules || [];
      if (selectedDataMappingRuleId.value && rules.some((rule) => rule.id === selectedDataMappingRuleId.value)) {
        return;
      }
      selectedDataMappingRuleId.value = rules[0]?.id || null;
    }

    function ensureMasterMatchEditorReady() {
      if (inspectorPanel.value !== 'master_match' || !inspectorExpanded.value) return;
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return;
      const rules = masterMatchRules.value;
      if (editingMasterMatchRuleId.value && rules.some((rule) => rule.id === editingMasterMatchRuleId.value)) {
        return;
      }
      if (rules.length) {
        editMasterMatchRule(rules[0]);
      } else {
        resetMasterMatchRuleFields();
      }
    }

    function onMasterMatchDraftSourceChange() {
      const src = getMasterSystemSource(masterMatchRuleDraft.masterSourceId);
      const cols = getMasterSourceColumnOptions(masterMatchRuleDraft.masterSourceId);
      masterMatchRuleDraft.lookupField = cols[0]?.value || '';
      masterMatchRuleDraft.outputFields = [];
      if (src?.sourceType === 'table') {
        masterMatchRuleDraft.masterSheet = src.sheets?.[0] || '';
      } else {
        masterMatchRuleDraft.masterSheet = '';
      }
    }

    function editMasterMatchRule(rule) {
      editingMasterMatchRuleId.value = rule.id;
      const r = normalizeMasterMatchRule(rule, { matchMethod: 'hybrid' });
      Object.assign(masterMatchRuleDraft, {
        name: r.name,
        inputKind: r.inputKind,
        standardFieldId: r.standardFieldId,
        docType: r.docType || sceneDocTypes.value[0] || '',
        field: r.field,
        scope: r.scope,
        masterSourceId: r.masterSourceId,
        masterSheet: r.masterSheet,
        lookupField: r.lookupField,
        outputFields: [...(r.outputFields || [])],
        matchMethod: r.matchMethod,
        returnMode: r.returnMode,
      });
    }

    function cancelMasterMatchRuleEdit() {
      const rules = masterMatchRules.value;
      if (rules.length) editMasterMatchRule(rules[0]);
      else resetMasterMatchRuleDraft();
    }

    function saveMasterMatchRuleFromDraft() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return;
      if (!masterMatchRuleDraft.name.trim()) {
        ElementPlus.ElMessage.warning('ルール名を入力してください');
        return;
      }
      if (masterMatchRuleDraft.inputKind === 'standard' && !masterMatchRuleDraft.standardFieldId) {
        ElementPlus.ElMessage.warning('標準フィールドを選択してください');
        return;
      }
      if (masterMatchRuleDraft.inputKind === 'ocr' && (!masterMatchRuleDraft.docType || !masterMatchRuleDraft.field)) {
        ElementPlus.ElMessage.warning('帳票タイプとフィールドを選択してください');
        return;
      }
      if (masterSourceRequiresSheet(masterMatchRuleDraft.masterSourceId) && !masterMatchRuleDraft.masterSheet) {
        ElementPlus.ElMessage.warning('シートを選択してください');
        return;
      }
      if (!masterMatchRuleDraft.lookupField) {
        ElementPlus.ElMessage.warning('照合列を選択してください');
        return;
      }
      if (!masterMatchRuleDraft.outputFields.length) {
        ElementPlus.ElMessage.warning('返却列を1件以上選択してください');
        return;
      }
      if (!Array.isArray(node.matchRules)) node.matchRules = [];
      const stdMeta = DATA_MAPPING_STANDARD_FIELDS.find((f) => f.value === masterMatchRuleDraft.standardFieldId);
      const payload = normalizeMasterMatchRule({
        id: editingMasterMatchRuleId.value || newRuleId('mr'),
        name: masterMatchRuleDraft.name.trim(),
        inputKind: masterMatchRuleDraft.inputKind,
        standardFieldId: masterMatchRuleDraft.standardFieldId,
        docType: masterMatchRuleDraft.docType,
        field: masterMatchRuleDraft.inputKind === 'standard'
          ? (stdMeta?.label || masterMatchRuleDraft.standardFieldId)
          : masterMatchRuleDraft.field,
        scope: masterMatchRuleDraft.scope,
        masterSourceId: masterMatchRuleDraft.masterSourceId,
        masterSheet: masterMatchRuleDraft.masterSheet,
        lookupField: masterMatchRuleDraft.lookupField,
        outputFields: [...masterMatchRuleDraft.outputFields],
        matchMethod: masterMatchRuleDraft.matchMethod,
        returnMode: masterMatchRuleDraft.returnMode,
      }, { matchMethod: node.matchMethod });
      const idx = node.matchRules.findIndex((rule) => rule.id === editingMasterMatchRuleId.value);
      if (idx >= 0) node.matchRules[idx] = payload;
      else node.matchRules.push(payload);
      node.masterSourceId = node.matchRules[0]?.masterSourceId || node.masterSourceId;
      node.knowledgeSource = resolveMasterMatchKnowledgeSource({ masterSourceId: node.masterSourceId });
      ElementPlus.ElMessage.success('照合ルールを保存しました');
      const savedId = payload.id;
      syncDictFieldsOnOutput();
      const saved = node.matchRules.find((rule) => rule.id === savedId);
      if (saved) editMasterMatchRule(saved);
      else resetMasterMatchRuleFields();
    }

    function removeMasterMatchRule(id) {
      const node = selectedWorkflowNode.value;
      if (!node?.matchRules) return;
      node.matchRules = node.matchRules.filter((rule) => rule.id !== id);
      if (editingMasterMatchRuleId.value === id) {
        ensureMasterMatchEditorReady();
      }
      syncDictFieldsOnOutput();
    }

    function getEffectiveMasterMappings() {
      const wf = form.workflows?.case;
      const fromNodes = [];
      (wf?.nodes || []).forEach((node) => {
        if (node.type !== 'master_match') return;
        (node.matchRules || []).forEach((rule) => {
          const r = normalizeMasterMatchRule(rule, { matchMethod: node.matchMethod });
          const src = getMasterSystemSource(r.masterSourceId);
          const ks = src?.sourceType === 'dict'
            ? { type: 'dict', dictionaryId: src.dictionaryId }
            : form.master?.knowledgeSource;
          fromNodes.push(enrichMasterRule({
            id: r.id,
            docType: r.inputKind === 'ocr' ? r.docType : '',
            field: r.inputKind === 'standard'
              ? (DATA_MAPPING_STANDARD_FIELDS.find((f) => f.value === r.standardFieldId)?.label || r.field)
              : r.field,
            lookupField: r.lookupField,
            outputFields: r.outputFields,
          }, ks));
        });
      });
      if (fromNodes.length) return fromNodes;
      return form.master.mappings;
    }

    const masterMatchSummaryRules = computed(() => masterMatchRules.value.slice(0, 5));

    const masterMatchSummaryRulesOverflow = computed(() =>
      Math.max(0, masterMatchRules.value.length - 5));

    const masterMatchMcpInputSummary = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'master_match') return null;
      const wf = getActiveWf();
      const mapping = getMasterMatchUpstreamDataMapping(wf, node.id);
      if (!mapping) {
        return {
          status: 'none',
          label: '上流データマッピング未接続',
        };
      }
      const varName = getWorkflowNodeVarName(mapping, wf);
      const mappedCount = (mapping.mappingRules || []).filter((r) => r.sourceFieldIds?.length && r.standardFieldId).length;
      return {
        status: 'ok',
        label: `標準フィールド ${mappedCount} 件`,
        varName,
        token: `{${varName}.standard_fields}`,
      };
    });

    const dataMappingSourceFieldOptions = computed(() => {
      const docOptions = (form.scene.documents || []).flatMap((doc) =>
        getDocFieldOptions(doc.type).map((field) => ({
          value: `${doc.type}.${field}`,
          label: `${getDocDisplayLabel(doc.type)} · ${field}`,
        })));
      return [
        { value: 'case.claimNo', label: '案件 · 請求番号' },
        { value: 'case.folderName', label: '案件 · 取込元フォルダ名' },
        ...docOptions,
      ];
    });

    const dataMappingStandardFieldOptions = computed(() =>
      DATA_MAPPING_STANDARD_FIELDS.map((field) => ({
        value: field.value,
        label: field.label,
      })));

    function getDataMappingStandardFieldMeta(fieldId) {
      return DATA_MAPPING_STANDARD_FIELDS.find((field) => field.value === fieldId) || null;
    }

    function getDataMappingFieldsByCategory(category) {
      return DATA_MAPPING_STANDARD_FIELDS.filter((field) => field.category === category);
    }

    const activeDataMappingRule = computed(() => {
      const node = getActiveDataMappingNode();
      const rules = node?.mappingRules || [];
      if (!rules.length) return null;
      return rules.find((rule) => rule.id === selectedDataMappingRuleId.value) || rules[0];
    });

    function selectDataMappingRule(ruleId) {
      selectedDataMappingRuleId.value = ruleId;
    }

    function getDataMappingDataTypeLabel(dataType) {
      return DATA_MAPPING_DATA_TYPES.find((opt) => opt.value === dataType)?.label || dataType || 'String';
    }

    function formatDataMappingRuleGenerationSummary(rule) {
      const preview = (rule?.structuredRulePreview || '').replace(/^AIルール:\s*/, '');
      const text = preview || (rule?.valueGenerationRule || '').trim();
      if (!text) return '未設定';
      return text.length > 46 ? `${text.slice(0, 46)}…` : text;
    }

    function addDataMappingRule() {
      const node = getActiveDataMappingNode();
      if (!node) return;
      const rule = normalizeDataMappingRule({
        sourceFieldIds: [],
        standardFieldId: DATA_MAPPING_STANDARD_FIELDS[0]?.value || '',
        dataType: DATA_MAPPING_STANDARD_FIELDS[0]?.dataType || 'string',
        valueGenerationRule: '',
        conflictCompareMode: 'normalized',
      });
      node.mappingRules = [...(node.mappingRules || []), rule];
      selectedDataMappingRuleId.value = rule.id;
    }

    function removeDataMappingRule(ruleId) {
      const node = getActiveDataMappingNode();
      if (!node) return;
      node.mappingRules = (node.mappingRules || []).filter((rule) => rule.id !== ruleId);
      if (selectedDataMappingRuleId.value === ruleId) {
        selectedDataMappingRuleId.value = node.mappingRules[0]?.id || null;
      }
    }

    function resetDataMappingRules() {
      const node = getActiveDataMappingNode();
      if (!node) return;
      node.mappingRules = defaultDataMappingRules();
      selectedDataMappingRuleId.value = node.mappingRules[0]?.id || null;
    }

    function insertDataMappingFieldToken(rule) {
      if (!rule) return;
      const fieldIds = rule.sourceFieldIds || [];
      if (!fieldIds.length) return;
      const token = fieldIds.map((fieldId) => `{{${fieldId}}}`).join('\n');
      const current = rule.valueGenerationRule || '';
      rule.valueGenerationRule = current ? `${current}\n${token}` : token;
    }

    function clearDataMappingRuleDraft(rule) {
      if (!rule) return;
      rule.valueGenerationRule = '';
      rule.structuredRulePreview = '';
    }

    function formatDataMappingStandardizationRule(rule, text) {
      const fieldIds = rule?.sourceFieldIds || [];
      const tokens = fieldIds.map((fieldId) => `{{${fieldId}}}`);
      const lines = (text || '')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const naturalLines = lines.filter((line) => !/^\{\{[^}]+\}\}$/.test(line));
      const natural = naturalLines.join(' ');
      const parts = [];
      if (natural) parts.push(natural);

      const ops = [];
      if (/金額|円|税込|カンマ|数値|number/i.test(natural)) {
        ops.push('正規表現: /[^0-9０-９.-]/g -> ""');
        ops.push('全角数字を半角化し、Number に変換する。');
      }
      if (/日付|西暦|和暦|yyyy|年月日|date/i.test(natural)) {
        ops.push('正規表現: /(明治|大正|昭和|平成|令和)?\\s*([0-9０-９]{1,4})[年\\/.-]([0-9０-９]{1,2})[月\\/.-]([0-9０-９]{1,2})日?/ で年月日を抽出する。');
        ops.push('yyyy-MM-dd に正規化する。');
      }
      if (/証券番号|番号|空白|スペース|ハイフン|trim/i.test(natural)) {
        ops.push('正規表現: /[\\s　-]/g -> ""');
      }
      if (/氏名|名前|契約者|被保険者|患者|全角|半角/i.test(natural)) {
        ops.push('全角・半角を正規化し、正規表現: /[\\s　]+/g -> "" で空白を除去する。');
      }
      if (/改行|複数行|傷病名|診断名|医療機関/i.test(natural)) {
        ops.push('正規表現: /[\\r\\n\\t]+/g -> " "');
      }
      if (/競合|不一致|複数帳票|複数値/i.test(natural) || fieldIds.length >= 2) {
        ops.push('複数値が異なる場合は自動補正せず、競合として出力する。');
      }
      if (!ops.length) {
        ops.push('選択した OCR フィールドを標準変数の入力元として使用する。');
      }

      parts.push(...[...new Set(ops)]);
      if (tokens.length) parts.push(tokens.join('\n'));
      return parts.join('\n');
    }

    function optimizeDataMappingRule(rule) {
      if (!rule) return;
      if (!(rule.sourceFieldIds || []).length) return;
      const text = (rule.valueGenerationRule || '').trim();
      if (!text) {
        rule.structuredRulePreview = 'OCRフィールドを選択し、標準化Ruleを入力してください。';
        return;
      }
      const generated = formatDataMappingStandardizationRule(rule, text);
      rule.structuredRulePreview = generated;
      rule.valueGenerationRule = generated;
    }

    const dataMappingSummaryRules = computed(() => {
      const node = getActiveDataMappingNode();
      const rules = node?.mappingRules || [];
      return rules.filter((rule) => rule.sourceFieldIds?.length && rule.standardFieldId).slice(0, 5);
    });

    const dataMappingSummaryRulesOverflow = computed(() => {
      const node = getActiveDataMappingNode();
      const rules = node?.mappingRules || [];
      const configured = rules.filter((rule) => rule.sourceFieldIds?.length && rule.standardFieldId).length;
      return Math.max(0, configured - 5);
    });

    const mcpServerCatalog = computed(() => mergeMcpServerCatalog(MCP_SERVER_SEEDS, form.mcpServers || []));

    const selectedMcpToolSchema = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp') return null;
      return getMcpToolDef(node.mcpServerId, node.mcpToolId, mcpServerCatalog.value);
    });

    const mcpSelectedServer = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node?.mcpServerId) return null;
      return getMcpServerDef(node.mcpServerId, mcpServerCatalog.value);
    });

    const mcpVariableOptions = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node) return [];
      return buildMcpVariableOptions(getActiveWf(), node.id, form.scene.documents, getDocDisplayLabel);
    });

    function getMcpToolsForServer(serverId) {
      return getMcpServerDef(serverId, mcpServerCatalog.value)?.tools || [];
    }

    function getMcpServerStatusMeta(status) {
      return MCP_SERVER_STATUS_META[status] || MCP_SERVER_STATUS_META.connected;
    }

    function selectMcpServer(server) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp' || !server) return;
      if (!isMcpServerSelectable(server)) {
        ElementPlus.ElMessage.warning(`「${server.label}」は ${getMcpServerStatusMeta(server.status).label} のため選択できません`);
        return;
      }
      node.mcpServerId = server.id;
      node.mcpToolId = '';
      node.mcpInputs = [];
    }

    function selectMcpTool(toolId) {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp' || !toolId) return;
      node.mcpToolId = toolId;
      node.mcpInputs = buildDefaultMcpInputs(node.mcpServerId, toolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
    }

    function onMcpServerChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp') return;
      const server = getMcpServerDef(node.mcpServerId, mcpServerCatalog.value);
      if (server && !isMcpServerSelectable(server)) {
        ElementPlus.ElMessage.warning(`「${server.label}」は ${getMcpServerStatusMeta(server.status).label} のため選択できません`);
        node.mcpServerId = '';
      }
      node.mcpToolId = '';
      node.mcpInputs = [];
    }

    function onMcpToolChange() {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp') return;
      node.mcpInputs = buildDefaultMcpInputs(node.mcpServerId, node.mcpToolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
    }

    const mcpNodeParamSummary = computed(() => {
      const node = selectedWorkflowNode.value;
      if (!node || node.type !== 'mcp' || !node.mcpToolId) return [];
      const tool = selectedMcpToolSchema.value;
      if (!tool?.params?.length) return [];
      const rows = node.mcpInputs?.length
        ? node.mcpInputs
        : buildDefaultMcpInputs(node.mcpServerId, node.mcpToolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
      return rows.map((row) => {
        const meta = tool.params.find((p) => p.key === row.key);
        const label = meta?.label || row.key;
        let display = row.value || '—';
        if (row.mode === 'variable') {
          const opt = mcpVariableOptions.value.find((o) => o.value === row.value);
          display = opt?.label || row.value || '—';
        }
        return { key: row.key, label, display, mode: row.mode };
      });
    });

    const mcpAdminReturnContext = ref(null);
    const mcpAdminSelectedServerId = ref('');
    const mcpAdminExpandedToolId = ref('');
    const mcpAdminDraftParams = reactive([]);

    const mcpAdminSelectedServer = computed(() => {
      if (!mcpAdminSelectedServerId.value) return null;
      return getMcpServerDef(mcpAdminSelectedServerId.value, mcpServerCatalog.value);
    });

    const mcpAdminTools = computed(() => mcpAdminSelectedServer.value?.tools || []);

    function openMcpServerManagement(serverId = '', toolId = '', fromWorkflow = false) {
      if (fromWorkflow) {
        mcpAdminReturnContext.value = {
          nodeId: selectedWorkflowNodeId.value,
        };
      } else {
        mcpAdminReturnContext.value = null;
      }
      const fallbackId = serverId || selectedWorkflowNode.value?.mcpServerId || mcpServerCatalog.value[0]?.id || '';
      mcpAdminSelectedServerId.value = fallbackId;
      mcpAdminExpandedToolId.value = toolId || selectedWorkflowNode.value?.mcpToolId || '';
      if (mcpAdminExpandedToolId.value) loadMcpAdminToolDraft();
      switchModule('mcp-servers');
    }

    function returnFromMcpAdmin() {
      const ctx = mcpAdminReturnContext.value;
      switchModule('case-workflow');
      if (ctx?.nodeId) {
        selectedWorkflowNodeId.value = ctx.nodeId;
        const node = getActiveWf()?.nodes?.find((n) => n.id === ctx.nodeId);
        syncCurrentNodeFromWorkflow(node);
        openWorkflowInspector('node');
      }
      mcpAdminReturnContext.value = null;
    }

    function selectMcpAdminServer(serverId) {
      mcpAdminSelectedServerId.value = serverId;
      mcpAdminExpandedToolId.value = '';
      mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length);
    }

    function loadMcpAdminToolDraft() {
      const serverId = mcpAdminSelectedServerId.value;
      const toolId = mcpAdminExpandedToolId.value;
      if (!serverId || !toolId) {
        mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length);
        return;
      }
      const rows = resolveMcpToolParamRows(serverId, toolId, mcpServerCatalog.value, form.mcpToolParamProfiles);
      mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length, ...rows.map((r) => ({ ...r })));
    }

    function expandMcpAdminTool(toolId) {
      mcpAdminExpandedToolId.value = mcpAdminExpandedToolId.value === toolId ? '' : toolId;
      if (mcpAdminExpandedToolId.value) loadMcpAdminToolDraft();
      else mcpAdminDraftParams.splice(0, mcpAdminDraftParams.length);
    }

    function setMcpAdminDraftParamMode(paramKey, mode) {
      const row = mcpAdminDraftParams.find((r) => r.key === paramKey);
      if (!row) return;
      row.mode = mode;
      if (mode === 'variable' && !String(row.value).startsWith('{{')) {
        row.value = mcpVariableOptions.value[0]?.value || '';
      }
      if (mode === 'fixed' && String(row.value).startsWith('{{')) {
        row.value = '';
      }
    }

    function applyMcpToolProfileToWorkflowNodes(serverId, toolId, rows) {
      const wf = getActiveWf();
      if (!wf?.nodes) return;
      wf.nodes.forEach((n) => {
        if (n.type === 'mcp' && n.mcpServerId === serverId && n.mcpToolId === toolId) {
          n.mcpInputs = cloneJson(rows);
        }
      });
    }

    function saveMcpAdminToolParams() {
      const serverId = mcpAdminSelectedServerId.value;
      const toolId = mcpAdminExpandedToolId.value;
      if (!serverId || !toolId) return;
      const rows = mcpAdminDraftParams.map((r) => ({ key: r.key, mode: r.mode || 'fixed', value: r.value ?? '' }));
      if (!form.mcpToolParamProfiles) form.mcpToolParamProfiles = {};
      if (!form.mcpToolParamProfiles[serverId]) form.mcpToolParamProfiles[serverId] = {};
      form.mcpToolParamProfiles[serverId][toolId] = rows;
      applyMcpToolProfileToWorkflowNodes(serverId, toolId, rows);
      const node = selectedWorkflowNode.value;
      if (node?.type === 'mcp' && node.mcpServerId === serverId && node.mcpToolId === toolId) {
        node.mcpInputs = cloneJson(rows);
      }
      ElementPlus.ElMessage.success('Tool パラメータを保存しました');
    }

    function getMcpAdminParamMeta(paramKey) {
      const tool = mcpAdminTools.value.find((t) => t.id === mcpAdminExpandedToolId.value);
      return tool?.params?.find((p) => p.key === paramKey);
    }

    function getWorkflowNodeIoFooter(node) {
      return getWorkflowNodeIo(node);
    }

    function ensureMcpInputRow(node, paramKey) {
      if (!node?.mcpInputs) node.mcpInputs = [];
      let row = node.mcpInputs.find((r) => r.key === paramKey);
      if (!row) {
        row = { key: paramKey, value: '', mode: 'fixed' };
        node.mcpInputs.push(row);
      }
      return row;
    }

    function getMcpInputMode(node, paramKey) {
      return ensureMcpInputRow(node, paramKey).mode || 'fixed';
    }

    function setMcpInputMode(node, paramKey, mode) {
      const row = ensureMcpInputRow(node, paramKey);
      row.mode = mode;
      if (mode === 'variable' && !String(row.value).startsWith('{{')) {
        row.value = mcpVariableOptions.value[0]?.value || '';
      }
      if (mode === 'fixed' && String(row.value).startsWith('{{')) {
        row.value = '';
      }
    }

    function getMcpInputValue(node, paramKey) {
      return ensureMcpInputRow(node, paramKey).value ?? '';
    }

    function setMcpInputValue(node, paramKey, value) {
      ensureMcpInputRow(node, paramKey).value = value;
    }

    const mcpServerCreateVisible = ref(false);
    const mcpServerCreateDraft = reactive({
      name: '',
      description: '',
      serverType: MCP_SERVER_TYPES[0].value,
      endpoint: '',
    });

    function openMcpServerCreateDialog() {
      Object.assign(mcpServerCreateDraft, {
        name: '',
        description: '',
        serverType: MCP_SERVER_TYPES[0].value,
        endpoint: '',
      });
      mcpServerCreateVisible.value = true;
    }

    function saveMcpServerFromDraft() {
      if (!mcpServerCreateDraft.name.trim()) {
        ElementPlus.ElMessage.warning('サーバー名を入力してください');
        return;
      }
      const id = `mcp-custom-${Date.now()}`;
      const item = normalizeMcpServerItem({
        id,
        label: mcpServerCreateDraft.name.trim(),
        description: mcpServerCreateDraft.description.trim() || `${MCP_SERVER_TYPES.find((t) => t.value === mcpServerCreateDraft.serverType)?.label || 'HTTP'} 接続（mock）`,
        status: 'connected',
        serverType: mcpServerCreateDraft.serverType,
        endpoint: mcpServerCreateDraft.endpoint.trim(),
        tools: [{
          id: 'invoke',
          label: 'カスタム呼び出し',
          description: '登録したエンドポイントを呼び出します',
          params: [
            { key: 'payload', label: 'Payload', type: 'string', required: false, placeholder: '{{ocr.fields}}' },
          ],
        }],
      });
      if (!form.mcpServers) form.mcpServers = [];
      form.mcpServers.push(item);
      mcpServerCreateVisible.value = false;
      ElementPlus.ElMessage.success('MCP サーバーを登録しました');
      if (currentModule.value === 'mcp-servers') {
        selectMcpAdminServer(item.id);
        mcpAdminExpandedToolId.value = item.tools[0]?.id || '';
        loadMcpAdminToolDraft();
      } else {
        const node = selectedWorkflowNode.value;
        if (node?.type === 'mcp') selectMcpServer(item);
      }
    }

    const knowledgeCreateVisible = ref(false);
    const knowledgeCreateDraft = reactive({
      name: '',
      description: '',
      embeddingModel: KNOWLEDGE_EMBEDDING_MODELS[0].value,
      type: 'document',
      webRootUrl: '',
      selector: 'body',
      apiEndpoint: '',
      apiKey: '',
    });

    function openKnowledgeCreateDialog() {
      Object.assign(knowledgeCreateDraft, {
        name: '',
        description: '',
        embeddingModel: KNOWLEDGE_EMBEDDING_MODELS[0].value,
        type: 'document',
        webRootUrl: '',
        selector: 'body',
        apiEndpoint: '',
        apiKey: '',
      });
      knowledgeCreateVisible.value = true;
    }

    function saveKnowledgeSource() {
      if (!knowledgeCreateDraft.name.trim()) {
        ElementPlus.ElMessage.warning('ナレッジ名を入力してください');
        return;
      }
      if (knowledgeCreateDraft.type === 'website' && !knowledgeCreateDraft.webRootUrl.trim()) {
        ElementPlus.ElMessage.warning('Web Root URL を入力してください');
        return;
      }
      const item = normalizeKnowledgeSourceItem({
        ...knowledgeCreateDraft,
        id: newRuleId('kb'),
        name: knowledgeCreateDraft.name.trim(),
        description: knowledgeCreateDraft.description.trim(),
        fileCount: knowledgeCreateDraft.type === 'document' ? 0 : undefined,
      });
      if (!form.knowledgeSources) form.knowledgeSources = [];
      form.knowledgeSources.push(item);
      const cfg = normalizeExternalApiConfig(form.processing.externalApi);
      if (!cfg.selectedSourceIds.includes(item.id)) {
        cfg.selectedSourceIds.push(item.id);
        form.processing.externalApi = cfg;
      }
      knowledgeCreateVisible.value = false;
      ElementPlus.ElMessage.success('ナレッジ数据源を作成しました');
    }

    function getKnowledgeSourceLabel(id) {
      return getKnowledgeCatalog(knowledgeCatalog.value, id)?.name || id;
    }

    function getKnowledgeSourceMeta(id) {
      return getKnowledgeCatalog(knowledgeCatalog.value, id);
    }

    function isKnowledgeSourceSelected(id) {
      return (form.processing.externalApi?.selectedSourceIds || []).includes(id);
    }

    function toggleKnowledgeSourceSelection(id) {
      const cfg = normalizeExternalApiConfig(form.processing.externalApi);
      const idx = cfg.selectedSourceIds.indexOf(id);
      if (idx >= 0) {
        if (cfg.selectedSourceIds.length <= 1) {
          ElementPlus.ElMessage.warning('少なくとも1件のナレッジを選択してください');
          return;
        }
        cfg.selectedSourceIds.splice(idx, 1);
      } else {
        cfg.selectedSourceIds.push(id);
      }
      form.processing.externalApi = cfg;
    }

    const masterKnowledgeSource = computed(() => normalizeKnowledgeSource(form.master.knowledgeSource));

    function onMasterKnowledgeSourceTypeChange(type) {
      form.master.knowledgeSource = normalizeKnowledgeSource(createMasterPipelineTool(type, { id: 'master-source' }));
    }

    function onMasterKnowledgeSourceDictChange() {
      syncDictFieldsOnOutput();
    }

    function getMasterKnowledgeIcon(type) {
      const icons = { dict: '📚', web_search: '🔍', web_crawl: '🌐', external_api: '🔗', llm: '✦' };
      return icons[type] || '📎';
    }

    const outputNamingPreview = computed(() => {
      const naming = form.output.naming || OUTPUT_NAMING_DEFAULTS;
      const ctx = {
        sceneName: form.scene.name || currentScene.value?.name,
        docType: getDocDisplayLabel(form.scene.documents?.[0]?.type || '診断書'),
      };
      const caseFile = resolveNamingPattern(naming.caseFilePattern, ctx);
      const docFile = resolveNamingPattern(
        naming.usePerDocFilePattern ? naming.docFilePattern : naming.caseFilePattern,
        ctx
      );
      return {
        caseFile: caseFile ? `${caseFile}.json` : '',
        docFile: docFile ? `${docFile}.json` : '',
        apiObjectKey: resolveNamingPattern(naming.apiObjectKey, ctx),
        apiPayloadName: resolveNamingPattern(naming.apiPayloadName, ctx),
        excelSheet: resolveNamingPattern(naming.excelSheetPattern, ctx),
      };
    });

    function insertNamingToken(targetKey, token) {
      if (!form.output.naming) {
        form.output.naming = normalizeOutputNaming(form.output);
      }
      const naming = form.output.naming;
      if (!naming) return;
      const current = String(naming[targetKey] || '');
      naming[targetKey] = current + token;
      if (targetKey === 'caseFilePattern') {
        form.output.fileNamePattern = naming.caseFilePattern;
      }
    }

    function onMasterTemplateChange(templateId) {
      form.master.templateId = templateId;
      const normalized = normalizeMasterConfig(form.master);
      form.master.toolChain = normalized.toolChain;
    }

    let syncDictFieldsCallCount = 0;
    function syncDictFieldsOnOutput() {
      syncDictFieldsCallCount += 1;
      if (syncDictFieldsCallCount <= 5 || syncDictFieldsCallCount % 50 === 0) {
      }
      form.output.docFields = attachDictFieldsToDocFields(
        form.output.docFields,
        getEffectiveMasterMappings(),
        form.master.knowledgeSource,
      );
    }

    watch(
      () => [inspectorExpanded.value, selectedWorkflowNodeId.value, inspectorPanel.value],
      () => {
        if (!inspectorExpanded.value) return;
        nextTick(() => {
          if (inspectorPanel.value === 'data_mapping') ensureDataMappingEditorReady();
          if (inspectorPanel.value === 'master_match') ensureMasterMatchEditorReady();
        });
      },
    );

    watch(
      () => {
        const src = form.master.knowledgeSource;
        return `${src?.type}:${src?.dictionaryId}:${src?.endpoint}:${src?.queryTemplate}`;
      },
      () => syncDictFieldsOnOutput(),
      { immediate: true, deep: true },
    );

    watch(
      () => {
        const wf = form.workflows?.case;
        return (wf?.nodes || [])
          .filter((node) => node.type === 'master_match')
          .map((node) => (node.matchRules || []).map((rule) => {
            const r = normalizeMasterMatchRule(rule, { matchMethod: node.matchMethod });
            return `${r.id}:${r.inputKind}:${r.docType}:${r.field}:${r.scope}:${r.masterSourceId}:${r.masterSheet}:${r.lookupField}:${(r.outputFields || []).join(',')}`;
          }).join('|'))
          .join('\u0001');
      },
      () => syncDictFieldsOnOutput(),
      { immediate: true },
    );

    watch(
      () => form.master.mappings.map((r) =>
        `${r.id}:${r.docType}:${r.field}:${r.lookupField}:${(r.outputFields || []).join(',')}`
      ).join('\u0001'),
      () => syncDictFieldsOnOutput(),
      { immediate: true, deep: true },
    );

    const dataRuleCount = computed(() => form.verify.dataRules.length);

    function textRuleDisplayText(rule) {
      const expr = (rule.text || '').trim();
      if (expr) return replaceDocTypeIdsInText(expr);
      return replaceDocTypeIdsInText(rule.natural || rule.label || '');
    }

    function textRuleExpressionText(rule) {
      return textRuleDisplayText(rule);
    }

    function formatFieldRef(fieldRef) {
      if (!fieldRef || !fieldRef.doc) return '';
      const docLabel = getDocDisplayLabel(fieldRef.doc);
      if (fieldRef.table && fieldRef.column) {
        return `${docLabel} · ${fieldRef.table}.${fieldRef.column}${fieldRef.sum ? ' 合計' : ''}`;
      }
      if (fieldRef.sum) return `${docLabel} · 合計`;
      return `${docLabel} · ${fieldRef.field}`;
    }

    function legacyCrossRuleText(rule) {
      if (rule.mode === 'natural') return rule.description || '';
      if (rule.mode === 'expression') {
        const op = rule.operator || '=';
        if (rule.operator === '正規表現') {
          return `${formatFieldRef(rule.left)} は正規表現 ${rule.rightRegex || rule.rightLiteral || '…'} に一致すること`;
        }
        if (rule.rightKind === 'literal' || rule.right?.literal) {
          return `${formatFieldRef(rule.left)} ${op} ${rule.rightLiteral || '…'}`;
        }
        return `${formatFieldRef(rule.left)} ${op} ${formatFieldRef(rule.right)}`;
      }
      if (rule.chips?.length) {
        return `${rule.chips.map((c) => formatFieldRef(c)).join('、')}は一致すること`;
      }
      return '';
    }

    function dataRuleNaturalText(rule) {
      return rule.description || rule.natural || rule.text || rule.label || '';
    }

    function dataRuleText(rule) {
      if (rule.expression?.trim()) return rule.expression.trim();
      const text = rule.text?.trim() || '';
      if (/\{\{[^}]+\}\}/.test(text)) return text;
      const desc = rule.description?.trim() || '';
      if (/\{\{[^}]+\}\}/.test(desc)) return desc;
      return legacyCrossRuleText(rule);
    }

    function dataRuleDisplayText(rule) {
      const expr = (rule.expression || rule.text || '').trim();
      if (expr) return replaceDocTypeIdsInText(expr);
      const derived = dataRuleText(rule);
      if (derived) return replaceDocTypeIdsInText(derived);
      return replaceDocTypeIdsInText(dataRuleNaturalText(rule));
    }

    function dataRuleExpressionText(rule) {
      return dataRuleDisplayText(rule);
    }

    const dataFieldOptions = computed(() => {
      const docs = dataPickerDocs.value || [];
      if (!docs.length) return [];
      const fieldSets = docs.map((doc) => new Set(getDocSchema(doc).fields || []));
      const shared = [...fieldSets[0]].filter((f) => fieldSets.every((set) => set.has(f)));
      if (shared.length) return shared;
      const union = new Set();
      docs.forEach((doc) => (getDocSchema(doc).fields || []).forEach((f) => union.add(f)));
      return [...union];
    });
    const textFieldOptions = computed(() => {
      const docs = textPickerDocs.value || [];
      if (!docs.length) return [];
      const fieldSets = docs.map((doc) => new Set(getDocSchema(doc).fields || []));
      const shared = [...fieldSets[0]].filter((f) => fieldSets.every((set) => set.has(f)));
      if (shared.length) return shared;
      const union = new Set();
      docs.forEach((doc) => (getDocSchema(doc).fields || []).forEach((f) => union.add(f)));
      return [...union];
    });

    const dataRuleSaveError = computed(() => validateExecutableRule(dataDraft.input.trim()));
    const textRuleSaveError = computed(() => validateTextRule(textDraft.input.trim()));
    const dataDraftSavable = computed(() => !dataRuleSaveError.value);
    const textDraftSavable = computed(() => !textRuleSaveError.value);
    const textExpressionExpanded = ref({});
    const dataExpressionExpanded = ref({});

    function isExpressionExpanded(type, ruleId) {
      const store = type === 'text' ? textExpressionExpanded.value : dataExpressionExpanded.value;
      return !!store[ruleId];
    }

    function toggleExpressionExpanded(type, ruleId) {
      const store = type === 'text' ? textExpressionExpanded.value : dataExpressionExpanded.value;
      store[ruleId] = !store[ruleId];
    }

    function resetRulePickers() {
      const docs = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      dataPickerDocs.value = [...docs];
      dataPickerField.value = '';
      textPickerDocs.value = [...docs];
      textPickerField.value = '';
    }

    function resetTextDraft() {
      textDraft.input = '';
      textDraft.compiled = '';
      textEditingId.value = null;
      textPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      textPickerField.value = '';
    }

    function resetDataDraft() {
      dataDraft.input = '';
      dataDraft.compiled = '';
      dataEditingId.value = null;
      dataPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      dataPickerField.value = '';
    }

    function editDataRule(rule) {
      dataEditingId.value = rule.id;
      dataDraftSyncing = true;
      dataDraft.input = dataRuleText(rule) || dataRuleNaturalText(rule) || '';
      dataDraft.compiled = '';
      dataDraftSyncing = false;
      dataPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      dataPickerField.value = '';
    }

    function cancelDataEdit() {
      resetDataDraft();
    }

    function insertDataFromPicker() {
      if (!dataPickerDocs.value.length || !dataPickerField.value) {
        ElementPlus.ElMessage.warning('帳票タイプとフィールドを選択してください');
        return;
      }
      const tokens = dataPickerDocs.value.map((doc) => formatFieldToken(doc, dataPickerField.value));
      dataDraft.input += (dataDraft.input ? ' ' : '') + tokens.join(' ');
    }

    function clearDataDraft() {
      dataDraft.input = '';
      dataDraft.compiled = '';
    }

    function dataDraftTolerance(expression) {
      return descriptionHasAmountFields(expression) ? '¥100' : '—';
    }

    function saveDataRule() {
      const expression = dataDraft.input.trim();
      const err = validateExecutableRule(expression);
      if (err) {
        ElementPlus.ElMessage.warning(err);
        return;
      }
      const readable = ruleReadableText(expression);
      const payload = {
        mode: 'expression',
        description: readable,
        natural: readable,
        expression,
        label: readable,
        tolerance: dataDraftTolerance(expression),
        action: DEFAULT_VERIFY_ACTION,
        invalid: false,
      };
      if (dataEditingId.value) {
        const idx = form.verify.dataRules.findIndex((r) => r.id === dataEditingId.value);
        if (idx >= 0) Object.assign(form.verify.dataRules[idx], payload);
        ElementPlus.ElMessage.success('検証ルールを更新しました');
      } else {
        form.verify.dataRules.push({ id: newRuleId('c'), ...payload });
        ElementPlus.ElMessage.success('検証ルールを追加しました');
      }
      resetDataDraft();
    }

    function removeDataRule(id) {
      form.verify.dataRules = form.verify.dataRules.filter((r) => r.id !== id);
      if (dataEditingId.value === id) resetDataDraft();
    }

    const sealRuleCount = computed(() => countSealDocTypes(form.verify.seal?.rules));

    function sealRuleDisplayText(rule) {
      const docs = sealRuleDocTypes(rule).map((doc) => getDocDisplayLabel(doc)).join('、');
      return `${docs} · ${rule.detectionTarget} · ${rule.threshold}%`;
    }

    function resetSealDraft() {
      sealDraft.docTypes = [];
      sealDraft.detectionTarget = '印鑑';
      sealDraft.threshold = 80;
      sealEditingId.value = null;
    }

    function editSealRule(rule) {
      sealEditingId.value = rule.id;
      sealDraft.docTypes = [...sealRuleDocTypes(rule)];
      sealDraft.detectionTarget = rule.detectionTarget || '両方';
      sealDraft.threshold = Number.isFinite(rule.threshold) ? rule.threshold : 80;
    }

    function cancelSealEdit() {
      resetSealDraft();
    }

    function saveSealRule() {
      if (!sealDraft.docTypes.length) {
        ElementPlus.ElMessage.warning('帳票タイプを選択してください');
        return;
      }
      if (!form.verify.seal) form.verify.seal = { rules: [] };
      if (!Array.isArray(form.verify.seal.rules)) form.verify.seal.rules = [];
      const otherRules = form.verify.seal.rules.filter((r) => r.id !== sealEditingId.value);
      const conflict = sealDraft.docTypes.find((docType) =>
        otherRules.some((r) => sealRuleDocTypes(r).includes(docType)),
      );
      if (conflict) {
        ElementPlus.ElMessage.warning(`${getDocDisplayLabel(conflict)} は既に他のルールに含まれています`);
        return;
      }
      const payload = {
        docTypes: [...sealDraft.docTypes],
        detectionTarget: sealDraft.detectionTarget,
        threshold: sealDraft.threshold,
      };
      if (sealEditingId.value) {
        const idx = form.verify.seal.rules.findIndex((r) => r.id === sealEditingId.value);
        if (idx >= 0) Object.assign(form.verify.seal.rules[idx], payload);
        ElementPlus.ElMessage.success('署名・印鑑ルールを更新しました');
      } else {
        form.verify.seal.rules.push({ id: newRuleId('seal'), ...payload });
        ElementPlus.ElMessage.success('署名・印鑑ルールを追加しました');
      }
      resetSealDraft();
    }

    function removeSealRule(id) {
      if (!form.verify.seal?.rules) return;
      form.verify.seal.rules = form.verify.seal.rules.filter((r) => r.id !== id);
      if (sealEditingId.value === id) resetSealDraft();
    }

    function aiAssistDataRule() {
      if (!dataDraft.input.trim()) {
        ElementPlus.ElMessage.warning('実行式を入力してください');
        return;
      }
      dataAiLoading.value = true;
      setTimeout(() => {
        dataDraft.input = optimizeRuleExpression(dataDraft.input);
        dataAiLoading.value = false;
        ElementPlus.ElMessage.success('実行式を最適化しました');
      }, 400);
    }

    function insertTextFromPicker() {
      if (!textPickerDocs.value.length || !textPickerField.value) {
        ElementPlus.ElMessage.warning('帳票タイプとフィールドを選択してください');
        return;
      }
      const tokens = textPickerDocs.value.map((doc) => formatFieldToken(doc, textPickerField.value));
      textDraft.input += (textDraft.input ? ' ' : '') + tokens.join(' ');
    }

    function clearTextDraft() {
      textDraft.input = '';
      textDraft.compiled = '';
    }

    function editTextRule(rule) {
      textEditingId.value = rule.id;
      textDraftSyncing = true;
      textDraft.input = rule.text || rule.natural || '';
      textDraft.compiled = '';
      textDraftSyncing = false;
      textPickerDocs.value = sceneDocTypes.value.length ? [sceneDocTypes.value[0]] : [];
      textPickerField.value = '';
    }

    function cancelTextEdit() {
      resetTextDraft();
    }

    function saveTextRule() {
      const expression = textDraft.input.trim();
      const err = validateTextRule(expression);
      if (err) {
        ElementPlus.ElMessage.warning(err);
        return;
      }
      const readable = ruleReadableText(expression);
      const payload = {
        mode: 'expression',
        text: expression,
        natural: readable,
        label: readable,
        action: DEFAULT_VERIFY_ACTION,
      };
      if (textEditingId.value) {
        const idx = form.verify.text.findIndex((r) => r.id === textEditingId.value);
        if (idx >= 0) Object.assign(form.verify.text[idx], payload);
        ElementPlus.ElMessage.success('テキスト検証ルールを更新しました');
      } else {
        form.verify.text.push({ id: newRuleId('t'), ...payload });
        ElementPlus.ElMessage.success('テキスト検証ルールを追加しました');
      }
      resetTextDraft();
    }

    function removeTextRule(id) {
      form.verify.text = form.verify.text.filter((r) => r.id !== id);
      if (textEditingId.value === id) resetTextDraft();
    }

    function aiAssistTextRule() {
      if (!textDraft.input.trim()) {
        ElementPlus.ElMessage.warning('実行式を入力してください');
        return;
      }
      textAiLoading.value = true;
      setTimeout(() => {
        textDraft.input = optimizeRuleExpression(textDraft.input);
        textAiLoading.value = false;
        ElementPlus.ElMessage.success('実行式を最適化しました');
      }, 400);
    }

    watch(dataPickerDocs, () => { dataPickerField.value = ''; }, { deep: true });
    watch(
      () => masterMatchRuleDraft.docType,
      (docType, prev) => {
        if (docType === prev) return;
        masterMatchRuleDraft.field = '';
      },
    );
    watch(textPickerDocs, () => { textPickerField.value = ''; }, { deep: true });
    watch(workflowSetupStep, (step) => {
      if (step === 2) enterWorkflowCanvasView();
    });

    watch(() => sceneSetupDraft.mainDocType, () => {
      clearSceneSetupLinkCheckDisplay();
      const fields = getSceneSetupFieldOptions(sceneSetupDraft.mainDocType);
      sceneSetupDraft.mainKey = fields.includes(sceneSetupDraft.mainKey) ? sceneSetupDraft.mainKey : (fields[0] || '');
      if (sceneSetupDraft.documents.length >= 2 && !(sceneSetupDraft.docFieldLinks || []).length) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        );
      }
    });
    watch(
      () => [
        sceneSetupDraft.documents.map((d) => d.type).join('\u0001'),
        (sceneSetupDraft.docFieldLinks || []).length,
      ].join('\u0002'),
      () => { clearSceneSetupLinkCheckDisplay(); },
    );
    let sceneSyncEffectCount = 0;
    watch(
      () => form.scene.documents.map((d) => d.type).join('\u0001'),
      () => {
        sceneSyncEffectCount += 1;
        if (sceneSyncEffectCount <= 5 || sceneSyncEffectCount % 50 === 0) {
        }
        const allowed = form.scene.documents.map((d) => d.type);
        const img = form.processing.image;
        const nextRotate = filterImageDocTypes(img.rotateDocTypes, allowed);
        const nextPerspective = filterImageDocTypes(img.perspectiveDocTypes, allowed);
        const nextSplit = filterImageDocTypes(img.splitDocTypes, allowed);
        if (JSON.stringify(nextRotate) !== JSON.stringify(img.rotateDocTypes || [])) img.rotateDocTypes = nextRotate;
        if (JSON.stringify(nextPerspective) !== JSON.stringify(img.perspectiveDocTypes || [])) img.perspectiveDocTypes = nextPerspective;
        if (JSON.stringify(nextSplit) !== JSON.stringify(img.splitDocTypes || [])) img.splitDocTypes = nextSplit;
        if (form.verify.seal?.rules?.length) {
          const nextSealRules = form.verify.seal.rules
            .map((r) => ({
              ...r,
              docTypes: sealRuleDocTypes(r).filter((doc) => allowed.includes(doc)),
            }))
            .filter((r) => r.docTypes.length > 0);
          if (JSON.stringify(nextSealRules) !== JSON.stringify(form.verify.seal.rules)) {
            form.verify.seal.rules = nextSealRules;
          }
        }
        applySceneAggregate(form.scene, form.scene.documents);
        syncOutputDocFieldsBySceneDocs();
      },
      { immediate: true },
    );
    syncOcrExtractTypes();
    resetTextDraft();
    resetDataDraft();
    resetSealDraft();
    syncCurrentNodeFromWorkflow(getActiveWf()?.nodes?.find((n) => n.id === selectedWorkflowNodeId.value));

    const addedDocTypes = computed(() =>
      new Set(sceneSetupDraft.documents.map((d) => d.type))
    );

    function isDocTypeAdded(typeId) {
      return addedDocTypes.value.has(typeId);
    }

    function openDocPicker() {
      if (sceneSetupDraft.documents.length >= MAX_DOCS) {
        ElementPlus.ElMessage.warning(`帳票は最大 ${MAX_DOCS} 件までです`);
        return;
      }
      docPickerMode.value = 'setup';
      docPickerSearch.value = '';
      syncDocPickerSelection();
      docPickerVisible.value = true;
    }

    function confirmAddDoc() {
      const targetDocs = sceneSetupDraft.documents;
      const ids = docPickerSelectedIds.value.filter((id) => DOC_TYPE_MAP[id] && !isDocTypeAdded(id));
      if (!ids.length) {
        ElementPlus.ElMessage.warning('追加する帳票を選択してください');
        return;
      }
      const remaining = MAX_DOCS - targetDocs.length;
      const toAdd = ids.slice(0, remaining);
      if (toAdd.length < ids.length) {
        ElementPlus.ElMessage.warning(`帳票は最大 ${MAX_DOCS} 件までです。${toAdd.length} 件を追加しました`);
      }
      toAdd.forEach((typeId) => {
        targetDocs.push({ type: typeId, submission: '必須', group: '', linkField: '' });
      });
      applySceneSetupAggregate();
      docPickerSelectedIds.value = [];
      docPickerVisible.value = false;
      if (!sceneSetupDraft.docFieldLinks.length && sceneSetupDraft.documents.length >= 2) {
        sceneSetupDraft.docFieldLinks = buildDefaultDocFieldLinks(
          sceneSetupDraft.documents,
          sceneSetupDraft.mainDocType ? [sceneSetupDraft.mainDocType] : [],
        );
      }
      if (toAdd.length) ElementPlus.ElMessage.success(`${toAdd.length} 件の帳票を追加しました`);
    }

    function removeDoc(index) {
      form.scene.documents.splice(index, 1);
      syncOcrExtractTypes();
      syncOutputDocFieldsBySceneDocs();
    }

    function onSubmissionChange(doc) {
      if (doc.submission === '代替可') doc.submission = '任意';
      doc.group = '';
      normalizeDocRequiredFields(doc);
    }

    function getDocCompletenessFieldOptions(doc) {
      return getDocFieldOptions(doc?.type);
    }

    function normalizeDocRequiredFields(doc) {
      if (!doc) return;
      const allowed = new Set(getDocCompletenessFieldOptions(doc));
      doc.requiredFields = Array.isArray(doc.requiredFields)
        ? [...new Set(doc.requiredFields.filter((field) => allowed.has(field)))]
        : [];
    }

    function getDocRequiredFieldCount(doc) {
      if (!doc || !Array.isArray(doc.requiredFields)) return 0;
      const allowed = new Set(getDocCompletenessFieldOptions(doc));
      return doc.requiredFields.filter((field) => allowed.has(field)).length;
    }

    function setDocRequiredFields(doc, checked) {
      if (!doc) return;
      doc.requiredFields = checked ? [...getDocCompletenessFieldOptions(doc)] : [];
    }

    function isChannelEnabled(channelId) {
      return form.processing.input.channels.includes(channelId);
    }

    function toggleChannel(channelId, enabled) {
      const channels = form.processing.input.channels;
      if (enabled) {
        if (!channels.includes(channelId)) channels.push(channelId);
      } else {
        const i = channels.indexOf(channelId);
        if (i >= 0) channels.splice(i, 1);
      }
    }

    function reorderExportStandardFields(fromIndex, toIndex) {
      const rows = activeOutputExportRows.value;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length || fromIndex === toIndex) return;
      const docType = outputSelectedDocType.value;
      const order = rows.map((row) => row.standardFieldId);
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      if (!form.output.exportStandardFieldOrderByDoc || typeof form.output.exportStandardFieldOrderByDoc !== 'object') {
        form.output.exportStandardFieldOrderByDoc = {};
      }
      form.output.exportStandardFieldOrderByDoc[docType] = order;
    }

    function moveExportStandardField(index, direction) {
      reorderExportStandardFields(index, index + direction);
    }

    function onExportStandardFieldDragStart(index, event) {
      outputDragState.kind = 'export-standard';
      outputDragState.docType = outputSelectedDocType.value;
      outputDragState.fromIndex = index;
      outputDragState.overIndex = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `export-standard:${index}`);
    }

    function onExportStandardFieldDragOver(index, event) {
      event.preventDefault();
      if (outputDragState.kind !== 'export-standard' || outputDragState.docType !== outputSelectedDocType.value) return;
      outputDragState.overIndex = index;
      event.dataTransfer.dropEffect = 'move';
    }

    function onExportStandardFieldDrop(index, event) {
      event.preventDefault();
      if (outputDragState.kind !== 'export-standard' || outputDragState.docType !== outputSelectedDocType.value || outputDragState.fromIndex < 0) return;
      reorderExportStandardFields(outputDragState.fromIndex, index);
      resetOutputDragState();
    }

    function onExportStandardFieldDragEnd() {
      if (outputDragState.kind === 'export-standard') resetOutputDragState();
    }

    function isExportStandardFieldDragOver(index) {
      return outputDragState.kind === 'export-standard'
        && outputDragState.docType === outputSelectedDocType.value
        && outputDragState.fromIndex >= 0
        && outputDragState.overIndex === index
        && outputDragState.fromIndex !== index;
    }

    function isExportStandardFieldDragging(index) {
      return outputDragState.kind === 'export-standard'
        && outputDragState.docType === outputSelectedDocType.value
        && outputDragState.fromIndex === index;
    }

    function reorderOutputExportRow(docType, fromIndex, toIndex) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc) return;
      if (!doc.itemOrder?.length) {
        doc.itemOrder = buildDefaultItemOrder(doc.fields, doc.tables);
      }
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= doc.itemOrder.length) return;
      const clampedTo = Math.min(toIndex, doc.itemOrder.length - 1);
      if (fromIndex === clampedTo) return;
      const [moved] = doc.itemOrder.splice(fromIndex, 1);
      doc.itemOrder.splice(clampedTo, 0, moved);
      applyItemOrderToDoc(doc);
    }

    function resetOutputDragState() {
      outputDragState.kind = '';
      outputDragState.docType = '';
      outputDragState.fromIndex = -1;
      outputDragState.overIndex = -1;
    }

    function onOutputExportRowDragStart(docType, index, event) {
      outputDragState.kind = 'export-row';
      outputDragState.docType = docType;
      outputDragState.fromIndex = index;
      outputDragState.overIndex = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${docType}:export-row:${index}`);
    }

    function onOutputExportRowDragOver(docType, index, event) {
      event.preventDefault();
      if (outputDragState.kind !== 'export-row' || outputDragState.docType !== docType) return;
      outputDragState.overIndex = index;
      event.dataTransfer.dropEffect = 'move';
    }

    function onOutputExportRowDrop(docType, index, event) {
      event.preventDefault();
      if (outputDragState.kind !== 'export-row' || outputDragState.docType !== docType || outputDragState.fromIndex < 0) return;
      reorderOutputExportRow(docType, outputDragState.fromIndex, index);
      resetOutputDragState();
    }

    function onOutputExportRowDragEnd() {
      resetOutputDragState();
    }

    function isOutputExportRowDragOver(docType, index) {
      return outputDragState.kind === 'export-row'
        && outputDragState.docType === docType
        && outputDragState.fromIndex >= 0
        && outputDragState.overIndex === index
        && outputDragState.fromIndex !== index;
    }

    function isOutputExportRowDragging(docType, index) {
      return outputDragState.kind === 'export-row'
        && outputDragState.docType === docType
        && outputDragState.fromIndex === index;
    }

    function moveOutputDocField(docType, fromIndex, direction) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc?.itemOrder?.length) return;
      const fieldKeys = doc.itemOrder.filter((k) => k.startsWith('field:'));
      const key = `field:${doc.fields[fromIndex]?.name}`;
      const orderIndex = doc.itemOrder.indexOf(key);
      if (orderIndex < 0) return;
      const targetFieldIndex = fromIndex + direction;
      if (targetFieldIndex < 0 || targetFieldIndex >= doc.fields.length) return;
      const targetKey = `field:${doc.fields[targetFieldIndex]?.name}`;
      const targetOrderIndex = doc.itemOrder.indexOf(targetKey);
      if (targetOrderIndex < 0) return;
      reorderOutputExportRow(docType, orderIndex, targetOrderIndex);
    }

    function reorderOutputDocField(docType, fromIndex, toIndex) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc?.itemOrder?.length) return;
      const key = `field:${doc.fields[fromIndex]?.name}`;
      const orderIndex = doc.itemOrder.indexOf(key);
      const targetKey = `field:${doc.fields[toIndex]?.name}`;
      const targetOrderIndex = doc.itemOrder.indexOf(targetKey);
      if (orderIndex < 0 || targetOrderIndex < 0) return;
      reorderOutputExportRow(docType, orderIndex, targetOrderIndex);
    }

    function outputTableColumnLabel(tableName, columnName) {
      return formatTableColumnLabel(tableName, columnName);
    }

    function outputFieldPath(docType, fieldName) {
      return formatFieldToken(docType, fieldName);
    }

    function toggleExportPreviewExpand(nodeId, event) {
      event?.stopPropagation?.();
      exportPreviewExpanded[nodeId] = !exportPreviewExpanded[nodeId];
    }

    function setExportPreviewSubtreeChecked(node, checked) {
      exportPreviewChecked[node.id] = checked;
      (node.children || []).forEach((child) => setExportPreviewSubtreeChecked(child, checked));
    }

    function onExportPreviewCheckboxChange(node, checked) {
      setExportPreviewSubtreeChecked(node, checked);
    }

    function toggleExportPreviewSelectAll(checked) {
      collectExportPreviewNodes(exportPreviewRoot.value).forEach((node) => {
        exportPreviewChecked[node.id] = checked;
      });
    }

    function onExportPreviewRowClick(node) {
      if (node.scope) outputSelectedExportScope.value = node.scope;
      if (node.docType) outputSelectedDocType.value = node.docType;
      if (node.kind === 'report') outputSelectedExportScope.value = 'report';
      if (node.ruleId) {
        outputSelectedExportScope.value = 'master_match';
        outputSelectedMasterRuleId.value = node.ruleId;
      } else if (node.scope === 'master_match' && node.kind === 'scope') {
        outputSelectedMasterRuleId.value = '';
      }
      if (node.parentScope === 'files' || (node.scope === 'files' && node.kind === 'file')) {
        outputSelectedExportScope.value = 'files';
        if (node.docType) outputSelectedDocType.value = node.docType;
      }
    }

    function isExportPreviewRowActive(node) {
      if (node.kind === 'report') return outputSelectedExportScope.value === 'report';
      if (node.scope === 'report') return outputSelectedExportScope.value === 'report';
      if (node.kind === 'master_rule') {
        return outputSelectedExportScope.value === 'master_match'
          && node.ruleId === outputSelectedMasterRuleId.value;
      }
      if (node.scope === 'master_match' && node.kind === 'scope') {
        return outputSelectedExportScope.value === 'master_match' && !outputSelectedMasterRuleId.value;
      }
      if (node.parentScope === 'files' || (node.scope === 'files' && node.kind === 'file')) {
        return outputSelectedExportScope.value === 'files'
          && (!node.docType || node.docType === outputSelectedDocType.value);
      }
      if (node.scope === 'files') return outputSelectedExportScope.value === 'files';
      if (node.scope === 'ocr' && !node.docType) return outputSelectedExportScope.value === 'ocr';
      return outputSelectedExportScope.value === 'ocr'
        && !!node.docType
        && node.docType === outputSelectedDocType.value;
    }

    function setOutputDeliveryMethod(label) {
      const opt = OUTPUT_DELIVERY_OPTIONS.find((item) => item.label === label);
      if (!opt) return;
      form.output.deliveryMethod = opt.value;
      form.output.format = opt.label;
      form.output.apiExportEnabled = opt.value === 'api';
    }

    function setOutputFormat(format) {
      setOutputDeliveryMethod(format);
    }

    function isExportStandardFieldChecked(row) {
      const ids = form.output.exportStandardFieldIds || [];
      if (!ids.length) return row.checked;
      return ids.includes(row.standardFieldId);
    }

    function toggleExportStandardField(row, checked) {
      let ids = [...(form.output.exportStandardFieldIds || [])];
      if (!ids.length) {
        ids = activeOutputExportRows.value
          .filter((item) => item.checked)
          .map((item) => item.standardFieldId);
      }
      if (checked) {
        if (!ids.includes(row.standardFieldId)) ids.push(row.standardFieldId);
      } else {
        ids = ids.filter((id) => id !== row.standardFieldId);
      }
      form.output.exportStandardFieldIds = ids;
    }

    function setActiveExportStandardFieldsChecked(checked) {
      const rows = activeOutputExportRows.value;
      form.output.exportStandardFieldIds = checked
        ? rows.map((row) => row.standardFieldId)
        : [];
    }

    function getExportStandardFieldSampleValue(standardFieldId) {
      const samples = {
        claimNo: 'REQ-2025-0018890',
        policyNo: '02468135-008-002',
        contractorName: '高橋 誠',
        insuredName: '高橋 真由美',
        insuredBirthDate: '1992-07-18',
        claimType: '入院給付金',
        admissionDate: '2025-09-08',
        dischargeDate: '2025-09-14',
        claimAmount: '420,000',
        medicalInstitutionName: '慶應大学病院',
        diagnosisName: '急性虫垂炎',
      };
      return samples[standardFieldId] || '—';
    }

    function getMasterMatchExportConfig(ruleId) {
      syncMasterMatchExportSettings();
      return (form.output.masterMatchExports || []).find((item) => item.ruleId === ruleId);
    }

    function updateMasterMatchExportConfig(ruleId, patch) {
      syncMasterMatchExportSettings();
      const idx = (form.output.masterMatchExports || []).findIndex((item) => item.ruleId === ruleId);
      if (idx < 0) return;
      form.output.masterMatchExports[idx] = {
        ...form.output.masterMatchExports[idx],
        ...patch,
      };
    }

    function toggleMasterMatchExportRule(ruleId, enabled) {
      updateMasterMatchExportConfig(ruleId, { enabled });
    }

    function setMasterMatchExportValueSource(ruleId, valueSource) {
      updateMasterMatchExportConfig(ruleId, { valueSource });
    }

    function setAllMasterMatchExportRulesChecked(checked) {
      syncMasterMatchExportSettings();
      form.output.masterMatchExports = (form.output.masterMatchExports || []).map((item) => ({
        ...item,
        enabled: checked,
      }));
    }

    function getMasterMatchExportSampleValue(row) {
      if (row.valueSource === 'ocr') return '（OCR原値）';
      if (row.valueSource === 'standard') return '（標準フィールド値）';
      const fields = row.ruleOutputFields || [];
      if (!fields.length) return '返却列未設定';
      return fields.join(' / ');
    }

    function setAllOutputDocFieldsChecked(docType, checked) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      if (!doc) return;
      (doc.fields || []).forEach((f) => { f.checked = checked; });
      (doc.tables || []).forEach((table) => {
        table.checked = checked;
        (table.columns || []).forEach((col) => { col.checked = checked; });
      });
    }

    function setActiveOutputDocFieldsChecked(checked) {
      const doc = activeOutputDocFields.value;
      if (!doc) return;
      setAllOutputDocFieldsChecked(doc.docType, checked);
    }

    function outputDocCheckedCount(docFields) {
      let count = (docFields.fields || []).filter((f) => f.checked).length;
      (docFields.tables || []).forEach((table) => {
        count += (table.columns || []).filter((c) => c.checked).length;
      });
      return count;
    }

    function outputDocTotalCount(docFields) {
      let count = (docFields.fields || []).length;
      (docFields.tables || []).forEach((table) => {
        count += (table.columns || []).length;
      });
      return count;
    }

    function outputTableColumnPath(docType, tableName, columnName) {
      return formatTableColumnToken(docType, tableName, columnName);
    }

    function canMoveOutputFieldUp(index) {
      return index > 0;
    }

    function canMoveOutputFieldDown(docType, index) {
      const doc = (form.output.docFields || []).find((d) => d.docType === docType);
      return !!doc && index < doc.fields.length - 1;
    }

    function outputDocFieldSummary(docFields) {
      const parts = [];
      const fTotal = (docFields.fields || []).length;
      if (fTotal) {
        const fChecked = docFields.fields.filter((f) => f.checked).length;
        parts.push(`フィールド ${fChecked}/${fTotal}`);
      }
      const tables = docFields.tables || [];
      if (tables.length) {
        const tChecked = tables.filter((t) => t.checked).length;
        const colChecked = tables.reduce(
          (n, t) => n + (t.checked ? t.columns.filter((c) => c.checked).length : 0),
          0
        );
        const colTotal = tables.reduce((n, t) => n + (t.columns || []).length, 0);
        parts.push(`テーブル ${tChecked}/${tables.length}（列 ${colChecked}/${colTotal}）`);
      }
      return parts.join(' · ') || '出力項目なし';
    }

    function getOutputSampleValue(docType, fieldLabel) {
      const name = String(fieldLabel || '').split('.').pop();
      const samples = {
        証券番号: '02468135-008-002',
        ご契約者氏名: '高橋 誠',
        'ご契約者氏名（カナ）': 'タカハシマコト',
        被保険者氏名: '高橋 真由美',
        被保険者生年月日: '1992-07-18',
        請求区分: '入院給付金',
        入院日: '2025-09-08',
        退院日: '2025-09-14',
        入院日数: '7',
        請求金額: '420,000',
        振込先金融機関名: 'みずほ銀行',
        合計金額: '128,400',
        医療機関名: '慶應大学病院',
        傷病名: '急性虫垂炎',
        診断名: '急性虫垂炎',
        発行日: '2025-09-15',
        金額: '128,400',
        診療日: '2025-09-12',
        氏名: '高橋 真由美',
        明細合計: '128,400',
        項目名: '入院基本料',
        数量: '1',
        単価: '42,000',
      };
      return samples[name] || samples[fieldLabel] || `${getDocExportLabel(docType)} 抽出値`;
    }

    function previewExportConfig() {
      const label = exportDeliveryMethodLabel.value;
      ElementPlus.ElMessage.info(`${label} 出力設定のプレビューを表示します`);
    }

    function applyOutputSelectionToSameType() {
      savedSnapshot.value = JSON.stringify(form);
      ElementPlus.ElMessage.success('同タイプの帳票へ反映しました');
    }

    function selectScene(id, options = {}) {
      if (!options.skipFinishRename && renamingSceneId.value && renamingSceneId.value !== id) {
        const renaming = scenes.value.find((s) => s.id === renamingSceneId.value);
        if (renaming) finishRenameScene(renaming);
      }
      currentSceneId.value = id;
      const scene = scenes.value.find((s) => s.id === id);
      if (!scene) return;
      const stored = loadSceneFromStorage(id);
      const next = normalizeLoadedForm(stored) || sceneFormByScene(scene);
      Object.keys(form).forEach((k) => delete form[k]);
      Object.assign(form, next);
      ensureFormWorkflows(form);
      syncMasterMatchNodesFromSceneMaster();
      savedSnapshot.value = JSON.stringify(form);
      if (options.focusScene) {
        selectedWorkflowNodeId.value = null;
        selectedWorkflowEdgeKey.value = null;
        inspectorMode.value = 'scene';
      } else {
        selectedWorkflowNodeId.value = form.workflows?.case?.nodes?.[0]?.id || 'wf-in';
        inspectorMode.value = 'node';
        syncCurrentNodeFromWorkflow(form.workflows.case?.nodes?.find((n) => n.id === selectedWorkflowNodeId.value));
      }
      initWorkflowHistory('案件フローを読み込み');
      workflowSetupStep.value = 2;
      sceneSetupVisible.value = false;
      sceneSetupMode.value = 'edit';
      sceneSetupDraft.sceneId = id;
      enterWorkflowCanvasView();
      nextTick(() => fitWorkflowToView());
    }

    function prevNode() {
      const i = nodeIndex.value;
      if (i > 0) currentNode.value = NODE_ORDER[i - 1];
    }

    function nextNode() {
      const i = nodeIndex.value;
      if (i < NODE_ORDER.length - 1) currentNode.value = NODE_ORDER[i + 1];
    }

    function validateSceneAggregate() {
      if (!getSceneMainDocType(form.scene)) return '主帳票を選択してください';
      return '';
    }

    function handleSave() {
      if (currentNode.value === 'scene') {
        const err = validateSceneAggregate();
        if (err) {
          ElementPlus.ElMessage.warning(err);
          return;
        }
      }
      savedSnapshot.value = JSON.stringify(form);
      saveStorage(currentSceneId.value, form);
      ElementPlus.ElMessage.success(isLastNode.value ? '設定を保存しました' : '保存しました');
    }

    function resetNode() {
      ElementPlus.ElMessageBox.confirm('このステップの変更を破棄してリセットしますか？', '', {
        confirmButtonText: 'OK',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }).then(() => {
        const saved = JSON.parse(savedSnapshot.value);
        const node = currentNode.value;
        if (node === 'scene') form.scene = saved.scene;
        else if (['input', 'image', 'hitl'].includes(node)) form.processing[node] = saved.processing[node];
        else if (node === 'ocr') form.processing.ocrExtract = cloneJson(saved.processing.ocrExtract || WORKFLOW_DEFAULTS.ocrExtract);
        else if (node === 'master') {
          form.processing.externalApi = cloneJson(saved.processing.externalApi || saved.processing.rag || KNOWLEDGE_RETRIEVAL_DEFAULTS);
          form.knowledgeSources = (saved.knowledgeSources || []).map(normalizeKnowledgeSourceItem);
          form.mcpServers = (saved.mcpServers || []).map(normalizeMcpServerItem);
          delete form.processing.rag;
        }
        else if (node === 'verify') {
          form.verify = saved.verify;
          form.master = cloneJson(saved.master);
        }
        else if (node === 'output') form.output = saved.output;
        ElementPlus.ElMessage.info('リセットしました');
      }).catch(() => {});
    }

    function syncOutputDocFieldsBySceneDocs() {
      form.output = normalizeOutputConfig(form.output, form.scene.documents, form.master.mappings, form.master.knowledgeSource);
    }

    function applyCommonHitlRoleToAll() {
      const role = form.processing.hitl.role;
      if (!role) {
        ElementPlus.ElMessage.warning('先に共通復核ロールを選択してください');
        return;
      }
      form.processing.hitl.imageRole = role;
      form.processing.hitl.ocrRole = role;
      form.processing.hitl.masterRole = role;
      form.processing.hitl.verifyRole = role;
      form.processing.hitl.exportRole = role;
      ElementPlus.ElMessage.success('共通ロールを各ノードへ適用しました');
    }

    function onHitlSpecificRolesToggle(enabled) {
      if (enabled) applyCommonHitlRoleToAll();
    }

    onMounted(() => {
      if (!form.master.knowledgeSource) {
        form.master.knowledgeSource = normalizeKnowledgeSource(null);
      }
      syncMasterMatchNodesFromSceneMaster();
      initWorkflowHistory('初期状態');
      // 确保 workflow layout 只在 mount 时执行一次（不能在 computed 内执行写操作）
      const _wfCase = form.workflows?.case;
      if (_wfCase && (!_wfCase.layoutVersion || _wfCase.layoutVersion < 3)) {
        layoutWorkflowGraph(_wfCase);
      }
      if (workflowSetupStep.value === 2) enterWorkflowCanvasView();
      nextTick(() => {
        fitWorkflowToView();
        flashWorkflowTemplateHint();
      });
      document.addEventListener('keydown', onWfKeyDown);
    });
    onBeforeUnmount(() => {
      if (wfTemplateHintTimer) clearTimeout(wfTemplateHintTimer);
      clearSceneSetupLinkCheckDisplay();
      document.removeEventListener('keydown', onWfKeyDown);
    });
    return {
      sceneSearch,
      currentSceneId,
      currentNode,
      currentProduct,
      form,
      scenes,
      nodes,
      extractFields,
      ocrExtractItems,
      ocrExtractStats,
      getOcrMergeSameType,
      setOcrMergeSameType,
      toggleOcrExtract,
      filteredScenes,
      treeProps,
      currentScene,
      sceneArchiveTree,
      isFirstNode,
      isLastNode,
      saveButtonText,
      sceneStats,
      outputFieldCount,
      outputTableStats,
      getSceneMainDocTypes,
      getSceneMainDocType,
      selectedHitlRoleHint,
      selectedHitlGateRoleHint,
      onHitlGateContextChange,
      onHitlGateConditionTypeChange: onHitlGateContextChange,
      onJudgmentContextChange,
      onDecisionElseLabelChange,
      getNotifyRecipientsLabel,
      getNotifyRecipientsPlaceholder,
      validateNotifyRecipients,
      onNotifyRecipientsBlur,
      CODE_PARAM_DATA_TYPES,
      CODE_PARAM_SOURCES,
      CODE_OUTPUT_TYPES,
      DEFAULT_CODE_PYTHON,
      codeVariableOptions,
      codeVariableOptionGroups,
      codeParamDialogVisible,
      codeParamDialogMode,
      codeParamDialogDraft,
      codeParamDialogTitle,
      codeParamDialogConfirmLabel,
      codeParamDialogSavable,
      openCodeParamDialog,
      closeCodeParamDialog,
      confirmCodeParamDialog,
      getCodeParamDataTypeLabel,
      getCodeParamSourceLabel,
      formatCodeInputRowDisplay,
      addCodeInputRow,
      removeCodeInputRow,
      onCodeFieldChange,
      formatCodeInputVariableToken,
      normalizeCodeNode,
      formatHitlActionsLabel,
      isHitlActionSelected,
      toggleHitlAction,
      judgmentAllowsElif,
      decisionVariableOptionGroups,
      decisionVariableCascaderOptions,
      getDecisionVariableOptionGroups,
      JUDGMENT_CONTEXT_OPTIONS,
      HITL_ACTION_OPTIONS,
      HITL_CONTEXT_OPTIONS,
      HITL_PRESET_OPTIONS,
      inferHitlContext,
      getHitlContextMeta,
      getHitlGatePreset,
      isHitlGateNode,
      HITL_GATE_PRESETS,
      CONDITION_NODE_PRESETS,
      GATEWAY_JUDGMENT_TYPES,
      GATEWAY_CONDITION_LOGIC,
      GATEWAY_TIMEOUT_STRATEGIES,
      GATEWAY_RERUN_POLICIES,
      decisionUsesThreshold,
      getGatewayTypeMeta,
      getDecisionThresholdLabel,
      getDecisionThresholdRange,
      decisionReturnTargetOptions,
      NOTIFY_CHANNELS,
      NOTIFY_TEMPLATES,
      onNotifyTemplateChange,
      getDecisionYesRule,
      getDecisionNoRule,
      getDecisionElseDisplayText,
      getDecisionCaseDisplayText,
      getDecisionIfCondition,
      getDecisionElseConditionPreview,
      getDecisionElseCanvasPreview,
      formatDecisionConditionToken,
      getNotifyNodeSubject,
      getNotifyNodeBodyPreview,
      getNotifyNodeBodyText,
      ocrModeTagType,
      outputConflictResolutions: OUTPUT_CONFLICT_RESOLUTIONS,
      outputMaskingLevels: OUTPUT_MASKING_LEVELS,
      outputFormats: OUTPUT_FORMATS,
      exportStepFormatOptions,
      OUTPUT_DELIVERY_OPTIONS,
      OUTPUT_TARGET_DEFAULT,
      OUTPUT_TIMING_LABEL,
      OUTPUT_VERIFY_REPORT_FIELDS,
      OUTPUT_NAMING_PREFIX_MODES,
      OUTPUT_NAMING_SERIAL_DIGIT_OPTIONS,
      OUTPUT_EXPORT_VALUE_SOURCES,
      exportDeliveryMethodLabel,
      exportNamingPreviewText,
      exportPreprocessedFileRows,
      masterMatchExportRows,
      activeMasterMatchExportRows,
      outputSelectedExportScope,
      outputSelectedMasterRuleId,
      applyOutputNamingPatterns,
      isExportStandardFieldChecked,
      toggleExportStandardField,
      setActiveExportStandardFieldsChecked,
      getExportStandardFieldSampleValue,
      toggleMasterMatchExportRule,
      setMasterMatchExportValueSource,
      setAllMasterMatchExportRulesChecked,
      getMasterMatchExportSampleValue,
      setOutputDeliveryMethod,
      outputEncodings: OUTPUT_ENCODINGS,
      outputSheetExportModeOptions: OUTPUT_SHEET_EXPORT_MODE_OPTIONS,
      DATA_MAPPING_STANDARD_FIELDS,
      DATA_MAPPING_FIELD_CATEGORIES,
      DATA_MAPPING_TRANSFORM_RULES,
      DATA_MAPPING_DATA_TYPES,
      DATA_MAPPING_OUTPUT_MODES,
      hitlRoleOptions: HITL_ROLE_OPTIONS,
      docPickerVisible,
      docPickerMode,
      sceneSetupVisible,
      workflowSetupStep,
      sceneSetupMode,
      sceneSetupDraft,
      configReuseDialogVisible,
      configReuseDraft,
      reusableSceneOptions,
      configReuseSelectedSource,
      nodeReuseDialogVisible,
      nodeReuseDraft,
      nodeReuseSceneOptions,
      nodeReuseSelectedSource,
      sceneReuseReviewVisible,
      selectedNodeReuseReviewVisible,
      sceneSetupPageTitle,
      sceneSetupSceneIdDisplay,
      sceneSetupConfirmLabel,
      sceneSetupDocTypeOptions,
      sceneSetupLinkStats,
      sceneSetupUnlinkedDocLabels,
      sceneSetupLinkCheckSummary,
      sceneSetupLinkCheckVisible,
      checkSceneDocLinks,
      sceneSetupNetworkLayout,
      sceneSetupAggregateRuleGroups,
      sceneSetupMainKeyOptions,
      SCENE_AGGREGATE_COMPARE_STRATEGIES,
      confirmSceneSetup,
      proceedToWorkflowStep,
      resetSceneSetup,
      enterWorkflowCanvasView,
      cancelSceneSetup,
      goToWorkflowSetupStep,
      openSceneSetupDocPicker,
      removeSceneSetupDoc,
      setSceneSetupMainDoc,
      addDocFieldLink,
      removeDocFieldLink,
      autoMatchDocFieldLinks,
      getSceneSetupLinkMainField,
      getSceneSetupLinkRelatedField,
      updateSceneSetupAggregateLink,
      addSceneSetupAggregateLink,
      removeSceneSetupAggregateLink,
      isSceneSetupAggregateDetailOpen,
      toggleSceneSetupAggregateDetail,
      getSceneSetupFieldOptions,
      getReuseStatusTone,
      getReuseStatusLabel,
      getConfigReuseScopeLabel,
      getReusableNodeTypeLabel,
      createBlankSceneFromDialog,
      copySceneFromConfigReuse,
      createBlankNodeFromReuseDialog,
      copyNodeFromReuseDialog,
      clearNodeReusePending,
      confirmSelectedNodeReuseReview,
      editSceneSettings,
      openEditCurrentSceneSettings,
      onSceneMenuCommand,
      getSceneMatchingLabel,
      docPickerSearch,
      docPickerSelectedIds,
      docTypeRegistryFiltered,
      DOC_TYPE_REGISTRY,
      docPickerAvailableCount,
      isDocTypeAdded,
      onDocPickerOpened,
      toggleDocPickerItem,
      isDocPickerItemSelected,
      openDocPicker,
      confirmAddDoc,
      removeDoc,
      onSubmissionChange,
      getDocCompletenessFieldOptions,
      normalizeDocRequiredFields,
      getDocRequiredFieldCount,
      setDocRequiredFields,
      getInputChannelLabel,
      inputChannels: INPUT_CHANNELS,
      isChannelEnabled,
      toggleChannel,
      moveOutputDocField,
      reorderOutputDocField,
      reorderOutputExportRow,
      onOutputExportRowDragStart,
      onOutputExportRowDragOver,
      onOutputExportRowDrop,
      onOutputExportRowDragEnd,
      isOutputExportRowDragOver,
      isOutputExportRowDragging,
      moveExportStandardField,
      reorderExportStandardFields,
      onExportStandardFieldDragStart,
      onExportStandardFieldDragOver,
      onExportStandardFieldDrop,
      onExportStandardFieldDragEnd,
      isExportStandardFieldDragOver,
      isExportStandardFieldDragging,
      activeOutputExportRows,
      outputTableColumnLabel,
      outputTableColumnPath,
      outputFieldPath,
      canMoveOutputFieldUp,
      canMoveOutputFieldDown,
      outputFieldsActivePanel,
      outputSelectedDocType,
      exportPreviewRows,
      exportPreviewExpanded,
      exportPreviewChecked,
      exportPreviewSelectAllState,
      toggleExportPreviewExpand,
      onExportPreviewCheckboxChange,
      toggleExportPreviewSelectAll,
      onExportPreviewRowClick,
      isExportPreviewRowActive,
      activeOutputDocFields,
      setOutputFormat,
      setAllOutputDocFieldsChecked,
      setActiveOutputDocFieldsChecked,
      outputDocCheckedCount,
      outputDocTotalCount,
      getOutputSampleValue,
      previewExportConfig,
      applyOutputSelectionToSameType,
      getDocExportLabel,
      getDocDisplayLabel,
      submissionDisplayLabel,
      submissionTagType,
      outputDocFieldSummary,
      selectScene,
      prevNode,
      nextNode,
      handleSave,
      resetNode,
      applyCommonHitlRoleToAll,
      onHitlSpecificRolesToggle,
      verifyActivePanels,
      completenessExpandedDocs,
      dataEditingId,
      dataDraft,
      dataPickerDocs,
      dataPickerField,
      dataFieldOptions,
      dataAiLoading,
      dataPreviewFlash,
      dataRuleDisplayText,
      dataRuleExpressionText,
      ruleReadableText,
      DATA_EXPRESSION_PLACEHOLDER,
      DATA_CONDITION_GUIDE,
      dataDraftSavable,
      dataRuleSaveError,
      dataRuleText,
      editDataRule,
      cancelDataEdit,
      insertDataFromPicker,
      clearDataDraft,
      saveDataRule,
      removeDataRule,
      aiAssistDataRule,
      sceneDocTypes,
      dataRuleCount,
      APP_NAV_GROUPS,
      currentModule,
      inspectorExpanded,
      inspectorExpandable,
      expandInspectorEditor,
      collapseInspectorEditor,
      primaryDataMappingNode,
      fixedDocSettingsTarget,
      isCaseWorkflowModule,
      modulePageMeta,
      INSPECTOR_HINTS,
      wfTemplateHintVisible,
      flashWorkflowTemplateHint,
      isWorkflowTopologyEditable,
      wfConnectSourceId,
      isConnectModeSource,
      getNodeMainOutTargetId,
      setNodeMainOutTarget,
      getDecisionPreset,
      getDecisionYesRule,
      getDecisionNoRule,
      getDecisionYesExpression,
      getDecisionConditionDisplay,
      DECISION_PRESET_EXPRESSION,
      getHitlGateYesRule,
      getHitlGateNoRule,
      getWorkflowYesExpression,
      workflowYesExpressionNote,
      activeDataMappingRule,
      selectDataMappingRule,
      getDataMappingDataTypeLabel,
      formatDataMappingRuleGenerationSummary,
      insertDataMappingFieldToken,
      clearDataMappingRuleDraft,
      optimizeDataMappingRule,
      INPUT_FORMAT_OPTIONS,
      INPUT_MAX_FILE_SIZE_MB,
      CASE_MATCHING_PRIORITY_OPTIONS,
      CASE_MASTERLESS_OPTIONS,
      CASE_SUPPLEMENT_OPTIONS,
      switchModule,
      openFixedDocSettings,
      formatDataMappingRuleSourceSummary,
      activeWorkflow,
      appNavCollapsed,
      docSettingsMenuOpen,
      toggleDocSettingsMenu,
      processingForm,
      FLOW_NODE_OPTIONS,
      wfNodePicker,
      wfNodePickerAvailableProcessGroups,
      wfNodePickerProcessGroups,
      wfNodePickerLogicOptions,
      wfNodePickerHoveredLogic,
      exitWorkflowInspector,
      openWfNodePicker,
      openWfNodePickerForDecisionBranch,
      closeWfNodePicker,
      pickWorkflowProcessNode,
      pickWorkflowLogicNode,
      showWfNodeAddBtn,
      showWfNodeAddInBtn,
      hasWorkflowIncomingEdge,
      renamingSceneId,
      createNewScene,
      startRenameScene,
      finishRenameScene,
      canUndoWorkflow,
      canRedoWorkflow,
      undoWorkflow,
      redoWorkflow,
      wfChangeHistoryVisible,
      workflowHistoryEntries,
      wfHistoryIndex,
      restoreWorkflowHistoryEntry,
      canSwapWorkflowNodeLeft,
      canSwapWorkflowNodeRight,
      swapSelectedWorkflowNode,
      wfConnectPreviewPath,
      selectedWorkflowNodeId,
      selectedWorkflowNode,
      inspectorPanel,
      inspectorTitle,
      inspectorHeadHint,
      workflowNodeOutputVars,
      workflowOutputVariableRows,
      workflowEndPreviewRows,
      showWorkflowNodeOutputSection,
      workflowNodeOutputHint,
      getWorkflowNodeOutputVarItems,
      formatWorkflowOutputVarToken,
      WORKFLOW_NODE_OUTPUT_VAR_DEFS,
      inspectorMode,
      workflowEdgePaths,
      selectWorkflowNode,
      removeWorkflowNode,
      confirmRemoveSelectedWorkflowNode,
      addWorkflowNodeFromLibrary,
      createWorkflowNodeAt,
      wfCanvasViewportRef,
      wfCanvasMaximized,
      wfCanvasNodesCollapsed,
      wfCanvasStageStyle,
      wfZoomPercent,
      workflowStageSize,
      fitWorkflowToView,
      zoomWorkflowIn,
      zoomWorkflowOut,
      resetWorkflowZoom,
      organizeWorkflowNodes,
      toggleWorkflowCanvasMaximized,
      toggleWorkflowNodesCollapsed,
      onWfViewportWheel,
      onWfViewportPointerDown,
      openSceneInspector,
      onWfLibraryDragStart,
      onWfCanvasDragOver,
      onWfCanvasDrop,
      onWfNodePointerDown,
      getWorkflowNodeMeta,
      getWorkflowNodeIconSvg,
      getWorkflowNodeCanvasSummary,
      getWorkflowNodeIoFooter,
      workflowOverviewSummary,
      WORKFLOW_WORKSHOP_CHECKLIST,
      MCP_SERVER_SEEDS,
      MCP_REGISTRY,
      MCP_OUTPUT_VARS,
      MCP_SERVER_STATUS_META,
      MCP_SERVER_TYPES,
      MCP_PARAM_MODES,
      mcpServerCatalog,
      mcpSelectedServer,
      mcpVariableOptions,
      getMcpServerStatusMeta,
      selectMcpServer,
      selectMcpTool,
      getMcpToolsForServer,
      onMcpServerChange,
      onMcpToolChange,
      selectedMcpToolSchema,
      getMcpInputMode,
      setMcpInputMode,
      getMcpInputValue,
      setMcpInputValue,
      formatMcpOutputVarToken,
      mcpServerCreateVisible,
      mcpServerCreateDraft,
      openMcpServerCreateDialog,
      openMcpServerManagement,
      returnFromMcpAdmin,
      mcpAdminReturnContext,
      mcpAdminSelectedServerId,
      mcpAdminExpandedToolId,
      mcpAdminSelectedServer,
      mcpAdminTools,
      mcpAdminDraftParams,
      selectMcpAdminServer,
      expandMcpAdminTool,
      loadMcpAdminToolDraft,
      saveMcpAdminToolParams,
      setMcpAdminDraftParamMode,
      getMcpAdminParamMeta,
      isMcpCustomServer,
      mcpNodeParamSummary,
      saveMcpServerFromDraft,
      isMcpServerSelectable,
      MASTER_MATCH_STRATEGIES,
      MASTER_MATCH_RETURN_MODES,
      MASTER_MATCH_INPUT_KINDS,
      MASTER_SYSTEM_SOURCES,
      masterMatchRules,
      masterMatchSummaryRules,
      masterMatchSummaryRulesOverflow,
      masterMatchMcpInputSummary,
      editingMasterMatchRuleId,
      masterMatchRuleDraft,
      masterMatchDraftFieldOptions,
      masterMatchDraftSheetOptions,
      masterMatchDraftLookupOptions,
      masterMatchDraftOutputOptions,
      masterMatchDraftRequiresSheet,
      masterMatchRuleInputSummary,
      masterMatchRuleMasterRefSummary,
      masterMatchRuleOutputSummary,
      masterMatchRuleMatchMethodSummary,
      masterMatchRuleReturnModeSummary,
      editMasterMatchRule,
      cancelMasterMatchRuleEdit,
      saveMasterMatchRuleFromDraft,
      removeMasterMatchRule,
      onMasterMatchDraftSourceChange,
      masterSourceRequiresSheet,
      dataMappingSourceFieldOptions,
      dataMappingStandardFieldOptions,
      getDataMappingStandardFieldMeta,
      getDataMappingFieldsByCategory,
      addDataMappingRule,
      removeDataMappingRule,
      resetDataMappingRules,
      dataMappingSummaryRules,
      dataMappingSummaryRulesOverflow,

      sceneSidebarCollapsed,
      toggleSceneSidebar,
      libraryPanelCollapsed,
      inspectorPanelCollapsed,
      inspectorPanelWidth,
      inspectorWorkspaceStyle,
      inspectorResizing,
      toggleLibraryPanel,
      toggleInspectorPanel,
      onInspectorResizeStart,
      getWorkflowNodeStyle,
      formatWfNodeLabel,
      getWorkflowNodeActiveTasks,
      PREPROCESS_SETTING_ITEMS,
      isPreprocessSettingOn,
      showPreprocessSettingDetail,
      DECISION_CONDITION_TYPES,
      DECISION_RESULT_VALUES,
      DECISION_OPERATORS,
      decisionVariableOptions,
      getDecisionVariableOptions,
      previewDecisionCase,
      previewDecisionNode,
      decisionConditionPreview,
      decisionUsesValueField,
      decisionUsesResultValue,
      onDecisionConditionFieldChange,
      onDecisionConditionTypeChange,
      onDecisionCustomExpressionChange,
      onDecisionYesRuleChange,
      onDecisionNoRuleChange,
      onDecisionThresholdChange,
      onHitlGateYesRuleChange,
      onHitlGateNoRuleChange,
      workflowConditionAiLoading,
      workflowConditionPreviewFlash,
      aiAssistWorkflowCondition,
      FRAUD_DETECT_METHOD_OPTIONS,
      FRAUD_DETECT_PS_CATEGORY,
      WORKFLOW_MAIN_CHAIN_ORDER,
      getWorkflowStartNode,
      getWorkflowMainChainOrderLabel,
      openWfNodePickerFromShortcut,
      addDecisionElifCase,
      removeDecisionCase,
      addDecisionCondition,
      removeDecisionCondition,
      getDecisionCaseKindLabel,
      getDecisionNodeBranches,
      getDecisionPortStyle,
      getDecisionPortLabelStyle,
      getDecisionBranchTarget,
      getDecisionBranchTargetId,
      setDecisionBranchTarget,
      isDecisionConditionAuto,
      isDecisionConditionPreset,
      isDecisionCasePreset,
      getWorkflowNodeDisplayLabel,
      workflowEdgeKey,
      selectedWorkflowEdgeKey,
      selectedWorkflowEdge,
      hoveredWorkflowEdgeKey,
      onWorkflowEdgeMouseEnter,
      onWorkflowEdgeMouseLeave,
      isWorkflowEdgeInsertVisible,
      openWfNodePickerOnEdge,
      workflowNodeOptions,
      getWorkflowEdgeSummary,
      selectWorkflowEdge,
      removeSelectedWorkflowEdge,
      onWfConnectHandleDown,
      onWfNodeAddInClick,
      onWfNodeAddOutClick,
      wfConnectDrag,
      wfConnectHoverTargetId,
      wfLibraryDrag,
      masterKnowledgeSource,
      EXTERNAL_API_IO,
      KNOWLEDGE_SOURCE_TYPES,
      KNOWLEDGE_EMBEDDING_MODELS,
      KNOWLEDGE_RETRIEVAL_MODES,
      KNOWLEDGE_OUTPUT_VARS,
      knowledgeCatalog,
      externalApiConfig,
      knowledgeQueryVariableOptions,
      knowledgeCreateVisible,
      knowledgeCreateDraft,
      openKnowledgeCreateDialog,
      saveKnowledgeSource,
      getKnowledgeSourceLabel,
      getKnowledgeSourceMeta,
      isKnowledgeSourceSelected,
      toggleKnowledgeSourceSelection,
      getWorkflowNodeVarName,
      getWorkflowNodeDefaultVarName,
      isWorkflowProcessingNode,
      getKnowledgeSourceTypeLabel,
      MASTER_KNOWLEDGE_SOURCE_TYPES,
      onMasterKnowledgeSourceTypeChange,
      onMasterKnowledgeSourceDictChange,
      getMasterDictFieldOptions,
      getMasterOutputFieldOptions,
      getMasterKnowledgeIcon,
      getMasterPipelineToolMeta,
      MASTER_TOOL_TEMPLATES,
      onMasterTemplateChange,
      outputNamingTokens: OUTPUT_NAMING_TOKENS,
      outputNamingPreview,
      insertNamingToken,
      textRuleDisplayText,
      textEditingId,
      textDraft,
      textPickerDocs,
      textPickerField,
      textFieldOptions,
      textAiLoading,
      textDraftSavable,
      textRuleSaveError,
      TEXT_EXPRESSION_PLACEHOLDER,
      TEXT_CONDITION_GUIDE,
      insertTextFromPicker,
      clearTextDraft,
      editTextRule,
      cancelTextEdit,
      saveTextRule,
      removeTextRule,
      aiAssistTextRule,
      sealEditingId,
      sealDraft,
      sealRuleCount,
      sealRuleDisplayText,
      SEAL_DETECTION_TARGETS,
      editSealRule,
      cancelSealEdit,
      saveSealRule,
      removeSealRule,
      SEAL_FIELD_SUGGESTIONS,
      textRuleExpressionText,
      isExpressionExpanded,
      toggleExpressionExpanded,
    };
  },
};

const InspectorFieldLabel = {
  name: 'InspectorFieldLabel',
  props: {
    label: { type: String, required: true },
    hint: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const { h, resolveComponent } = Vue;
      if (!props.hint) {
        return h('label', { class: 'inspector-field-label' }, props.label);
      }
      const ElTooltip = resolveComponent('ElTooltip');
      return h('label', { class: 'inspector-field-label inspector-field-label--with-tip' }, [
        h('span', null, props.label),
        h(
          ElTooltip,
          { content: props.hint, placement: 'top', showAfter: 200 },
          {
            default: () =>
              h(
                'button',
                { type: 'button', class: 'inspector-field-tip', 'aria-label': '説明' },
                '?',
              ),
          },
        ),
      ]);
    };
  },
};

const InspectorTitle = {
  name: 'InspectorTitle',
  props: {
    title: { type: String, required: true },
    hint: { type: String, default: '' },
    extraClass: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      const { h, resolveComponent } = Vue;
      const children = [h('span', null, props.title)];
      if (props.hint) {
        const ElTooltip = resolveComponent('ElTooltip');
        children.push(
          h(
            ElTooltip,
            { content: props.hint, placement: 'top', showAfter: 200 },
            {
              default: () =>
                h(
                  'button',
                  { type: 'button', class: 'inspector-field-tip', 'aria-label': '説明' },
                  '?',
                ),
            },
          ),
        );
      }
      const classes = ['inspector-section-title', 'inspector-section-title--with-tip'];
      if (props.extraClass) classes.push(props.extraClass);
      return h('div', { class: classes }, children);
    };
  },
};

function extractAppTemplateFromHtml(html) {
  const marker = '<div id="app">';
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const contentStart = start + marker.length;
  const scriptIdx = html.indexOf('<script', contentStart);
  if (scriptIdx < 0) return '';
  const end = html.lastIndexOf('</div>', scriptIdx);
  if (end < contentStart) return '';
  return html.slice(contentStart, end);
}

function resolveAppTemplateFallback() {
  return document.getElementById('app')?.innerHTML ?? '';
}

async function bootstrapApp() {
  let template = '';
  try {
    const indexUrl = new URL('index.html', window.location.href).href;
    const res = await fetch(indexUrl, { cache: 'no-store' });
    if (res.ok) {
      const extracted = extractAppTemplateFromHtml(await res.text());
      if (extracted) template = extracted;
    }
  } catch (_) {}
  if (!template) template = resolveAppTemplateFallback();

  const app = createApp({ ...appOptions, template });
  app.component('InspectorFieldLabel', InspectorFieldLabel);
  app.component('InspectorTitle', InspectorTitle);
  app.use(ElementPlus);
  try {
    app.mount('#app');
  } catch (mountErr) {
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#b42318;background:#fef3f2;border:1px solid #fecdca;border-radius:8px;margin:16px;">'
        + '<strong>アプリの起動に失敗しました</strong><pre style="white-space:pre-wrap;margin-top:12px;font-size:13px;">'
        + String(mountErr?.message || mountErr).replace(/</g, '&lt;')
        + '</pre></div>';
    }
    throw mountErr;
  }
}

bootstrapApp();
