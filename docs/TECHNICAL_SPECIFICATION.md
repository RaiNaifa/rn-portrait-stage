# RN Portrait Stage — техническое задание

> Статус документа: черновик для обсуждения и последовательной реализации
> Последнее обновление: 2026-08-21
> Рабочее название модуля: **RN Portrait Stage**
> Идентификатор модуля: `rn-portrait-stage`

---

## 0. Как пользоваться этим документом

Этот файл является основным техническим заданием и источником истины для проекта. Требования сформулированы отдельными нумерованными пунктами, чтобы их было удобно обсуждать, изменять и отмечать выполненными.

Обозначения:

- `[ ]` — не реализовано;
- `[~]` — реализуется или реализовано частично;
- `[x]` — реализовано и проверено;
- **MVP** — обязательно для первой практически полезной версии;
- **V1** — нужно для первого стабильного релиза;
- **Later** — заложить в архитектуру, реализацию можно отложить;
- **Experimental** — функция без гарантии одинаковой работы во всех окружениях.

При изменении важного архитектурного решения следует:

1. Обновить соответствующий раздел ТЗ.
2. Добавить запись в раздел «Журнал решений».
3. Если меняется формат сохранённых данных — увеличить `schemaVersion` и описать миграцию.

---

## 1. Краткое описание проекта

**RN Portrait Stage** — системно-агностичный модуль для Foundry Virtual Tabletop v13 и v14, который показывает портреты персонажей и NPC непосредственно в интерфейсе Foundry, независимо от наличия их токенов на активной сцене.

Модуль должен позволять:

- формировать для каждой сцены набор отображаемых персонажей и NPC;
- располагать портреты около штатных элементов интерфейса Foundry;
- выбирать изображения независимо от `Actor.img` и изображения токена;
- отображать дополнительную информацию и действия при наведении;
- опционально связывать портрет с токеном на сцене;
- переключать варианты портрета вместе с заранее заданными изменениями;
- сохранять и загружать пресеты;
- предоставлять публичный API и hooks для игровых систем и других модулей;
- в дальнейшем применять визуальные эффекты и реагировать на локальную голосовую активность.

Модуль не должен требовать наличия конкретной игровой системы, TokenMagic, FXMaster, socketlib или других сторонних модулей.

---

## 2. Цели и границы проекта

### 2.1. Основные цели

- [ ] **G-001 — MVP.** Показывать выбранных Actor как портретные карточки вне canvas.
- [ ] **G-002 — MVP.** Разделять персонажей и NPC по двум независимо настраиваемым группам.
- [ ] **G-003 — MVP.** Сохранять состав и порядок портретов для каждой Scene.
- [ ] **G-004 — MVP.** Работать при полном отсутствии токенов Actor на сцене.
- [ ] **G-005 — MVP.** Поддерживать Foundry VTT v13 и v14.
- [ ] **G-006 — V1.** Предоставлять расширяемое hover-содержимое и действия.
- [ ] **G-007 — V1.** Предоставлять переключаемые варианты портретов и пресеты.
- [ ] **G-008 — V1.** Соблюдать ownership, видимость и полномочия GM/игроков.
- [ ] **G-009 — Later.** Предоставлять собственный расширяемый движок эффектов портретов.
- [ ] **G-010 — Experimental.** Подсвечивать привязанный к пользователю портрет по локальной голосовой активности без передачи аудио.

### 2.2. Что не является целью ядра модуля

- [ ] **NG-001.** Модуль не заменяет Actor Sheet.
- [ ] **NG-002.** Модуль не создаёт обязательные токены на сцене.
- [ ] **NG-003.** Модуль не воспроизводит полностью PIXI Token HUD внутри HTML-портрета.
- [ ] **NG-004.** Модуль не знает структуру `actor.system` конкретных игровых систем без зарегистрированного адаптера.
- [ ] **NG-005.** Модуль не передаёт, не записывает и не распознаёт содержание речи.
- [ ] **NG-006.** Модуль не зависит от встроенного Foundry AV.
- [ ] **NG-007.** Первая версия не обязана поддерживать произвольное прикрепление панели к любому DOM-элементу мышью.
- [ ] **NG-008.** Первая версия не обязана реализовывать PIXI/WebGL-эффекты уровня TokenMagic.

---

## 3. Термины

- **Portrait / портрет** — визуальная карточка Actor в интерфейсе модуля.
- **Portrait entry / запись портрета** — сохранённые данные одного портрета в составе сцены.
- **Group / группа** — набор портретов с общей точкой размещения и направлением раскладки.
- **PC group** — группа персонажей; по умолчанию слева.
- **NPC group** — группа NPC; по умолчанию справа.
- **Portrait variant / вариант** — сохранённый вариант изображения и связанных действий.
- **Hover block** — информационный блок, показываемый при наведении.
- **Portrait action** — кнопка или команда, связанная с портретом.
- **Provider** — зарегистрированное системой или модулем расширение, предоставляющее данные/содержимое.
- **Anchor** — точка интерфейса, относительно которой размещается группа.
- **Linked token** — необязательный TokenDocument, связанный с записью портрета.
- **Speaking state** — булево временное состояние голосовой активности назначенного пользователя.

---

## 4. Поддерживаемые версии и совместимость

### 4.1. Foundry

- [ ] **COMP-001 — MVP.** `compatibility.minimum` должен быть равен `13`.
- [ ] **COMP-002 — MVP.** Проверять работу на актуальной стабильной сборке v13.
- [ ] **COMP-003 — MVP.** Проверять работу на актуальной стабильной сборке v14.
- [ ] **COMP-004.** Не указывать `verified: 14` до фактического тестирования v14.
- [ ] **COMP-005.** По возможности использовать только публичный Foundry API.
- [ ] **COMP-006.** Обращения к внутренним API и DOM Foundry изолировать в compatibility-слое.
- [ ] **COMP-007.** Любой внутренний API документировать комментарием с причиной использования и fallback-поведением.

### 4.2. Игровые системы

- [ ] **SYS-001 — MVP.** Ядро не должно читать конкретные пути из `actor.system`.
- [ ] **SYS-002 — MVP.** Без адаптера должны работать имя, изображения, Actor UUID, Token UUID, ownership и универсальные Active Effects.
- [ ] **SYS-003 — V1.** Система или интеграционный модуль может регистрировать hover blocks, actions, image resolvers и conditions.
- [ ] **SYS-004 — V1.** Ошибка системного provider не должна ломать остальные портреты.
- [ ] **SYS-005 — V1.** В UI показывать, каким пакетом зарегистрировано расширение.

### 4.3. Первый собственный адаптер

- [ ] **SYS-LITM-001 — Later/V1.** Предусмотреть интеграцию с `litm-rn`.
- [ ] **SYS-LITM-002.** Интеграция может показывать теги истории.
- [ ] **SYS-LITM-003.** Интеграция может показывать статусы персонажа.
- [ ] **SYS-LITM-004.** Интеграция может добавить кнопку показа/скрытия тегов.
- [ ] **SYS-LITM-005.** Логику Tag Manager не копировать в ядро RN Portrait Stage; использовать публичный адаптер.

---

## 5. Роли, права и видимость

### 5.1. Gamemaster

- [ ] **PERM-001 — MVP.** GM может добавлять и удалять любые доступные Actor.
- [ ] **PERM-002 — MVP.** GM может изменять порядок и группу портретов.
- [ ] **PERM-003 — MVP.** GM может менять сценический портрет у всех клиентов.
- [ ] **PERM-004 — V1.** GM может редактировать варианты портретов.
- [ ] **PERM-005 — V1.** GM может сохранять и применять мировые/сценовые пресеты.
- [ ] **PERM-006 — Experimental.** GM может выбирать Actor, за которого сейчас маршрутизируется его speaking state.

### 5.2. Игрок

- [~] **PERM-010 — MVP.** Игрок видит все портреты, явно добавленные GM на Portrait Stage; системные дополнительные данные позднее проходят собственную permission-проверку.
- [ ] **PERM-011 — V1.** Игрок может менять сценический вариант портрета Actor, которым он владеет, если это разрешено мировой настройкой.
- [ ] **PERM-012 — V1.** Изменение `Actor.img`, Prototype Token и TokenDocument требует реального права обновления документа.
- [ ] **PERM-013 — V1.** Недоступные кнопки не только скрываются, но и повторно проверяют полномочия при выполнении.
- [ ] **PERM-014 — Experimental.** Игрок может иметь только одного Actor, назначенного ему для voice activation.

### 5.3. Защита скрытых данных

- [~] **PERM-020 — MVP.** Явное добавление Actor на Portrait Stage считается решением GM показать его сценическое имя и изображение всем; не добавленные Actor не раскрываются.
- [ ] **PERM-021 — V1.** Hover provider обязан учитывать текущего пользователя.
- [ ] **PERM-022 — V1.** Core не передаёт клиенту закрытые системные данные специально для hover.
- [ ] **PERM-023 — V1.** Ошибки permissions логировать без вывода закрытых данных в notification.

---

## 6. Модель интерфейса

### 6.1. Группы по умолчанию

- [ ] **UI-001 — MVP.** Создать группу персонажей слева.
- [ ] **UI-002 — MVP.** Точка вставки v13/v14 по умолчанию: `#ui-left-column-2`.
- [ ] **UI-003 — MVP.** Создать группу NPC справа.
- [ ] **UI-004 — MVP.** Точка вставки v13/v14 по умолчанию: `#ui-right-column-1`.
- [ ] **UI-005 — MVP.** Если anchor отсутствует, использовать fallback-контейнер относительно `#interface`.
- [ ] **UI-006 — MVP.** Панель не должна менять размеры canvas и штатных колонок Foundry без отдельной настройки.
- [ ] **UI-007.** Панель не должна блокировать клики по невидимой области вокруг портретов.

### 6.2. Настройки раскладки

- [ ] **UI-010 — MVP.** Размер портрета в px.
- [ ] **UI-011 — MVP.** Промежуток между портретами.
- [ ] **UI-012 — MVP.** Отступ по X и Y от anchor.
- [ ] **UI-013 — MVP.** Направление сверху вниз / снизу вверх.
- [ ] **UI-014 — V1.** Режим `column` / `row`.
- [ ] **UI-015 — V1.** Направление слева направо / справа налево.
- [ ] **UI-016 — V1.** Максимальная ширина/высота группы и прокрутка/перенос.
- [ ] **UI-017 — V1.** Прозрачность неактивных портретов.
- [ ] **UI-018 — V1.** Масштаб интерфейса отдельно от размера исходного изображения.
- [ ] **UI-019 — V1.** Сворачивание/скрытие каждой группы.
- [ ] **UI-020 — V1.** Клиентская возможность скрыть весь модуль без изменения состава сцены.

### 6.3. Будущее свободное позиционирование

- [ ] **UI-030 — Later.** Режим выбора DOM-элемента мышью как anchor.
- [ ] **UI-031 — Later.** Drag-and-drop позиционирование группы.
- [ ] **UI-032 — Later.** Не хранить только хрупкий произвольный CSS selector; хранить семантический anchor и fallback.
- [ ] **UI-033 — Later.** Поддержать сторону anchor: `top`, `right`, `bottom`, `left`, `inside`.
- [ ] **UI-034 — Later.** Предоставить визуальный preview области размещения.

### 6.4. Responsive-поведение

- [ ] **UI-040 — V1.** Корректно работать при 1280×720 и выше.
- [ ] **UI-041 — V1.** Не перекрывать критичные элементы при узком viewport без предупреждения/fallback.
- [ ] **UI-042 — V1.** Реагировать на resize окна и изменение sidebar.
- [ ] **UI-043 — V1.** Учесть browser zoom и Foundry UI scale.

---

## 7. Запись портрета

### 7.1. Обязательные свойства

Предварительная структура:

```js
{
  id: "local-entry-id",
  actorUuid: "Actor.abc123",
  tokenUuid: null,
  groupId: "pcs",
  sort: 1000,
  visible: true,
  image: {
    source: "actor",        // actor | prototypeToken | custom | variant
    customSrc: null
  },
  hover: {},
  actions: [],
  effects: [],
  activeVariantId: null,
  userVariants: {},
  flags: {}
}
```

`activeVariantId` является общим вариантом по умолчанию. `userVariants[userId]` содержит назначенное GM индивидуальное переопределение для конкретного клиента.

Библиотека портретов Actor использует схему v2. Каждый вариант содержит политику `access`, наследуемые визуальные `settings` и отдельный раздел `gm` для служебной автоматизации. На клиенте сначала разрешается `userVariants[game.user.id]`, затем общий `activeVariantId`.

- [ ] **ENTRY-001 — MVP.** Использовать UUID Actor, а не только `_id`.
- [ ] **ENTRY-002 — MVP.** Token UUID является необязательным.
- [ ] **ENTRY-003 — MVP.** У одной Scene может быть несколько записей одного Actor только при явном разрешении.
- [ ] **ENTRY-004 — MVP.** Потерянный Actor не ломает рендер группы.
- [ ] **ENTRY-005 — V1.** UI для поиска и замены потерянной ссылки.
- [ ] **ENTRY-006 — V1.** Запись имеет стабильный локальный ID, независимый от Actor.

### 7.2. Источники изображения

- [ ] **IMG-001 — MVP.** `Actor.img`.
- [ ] **IMG-002 — MVP.** `Actor.prototypeToken.texture.src`.
- [ ] **IMG-003 — MVP.** Пользовательский путь, сохранённый только в данных модуля.
- [ ] **IMG-004 — V1.** Изображение конкретного TokenDocument.
- [ ] **IMG-005 — V1.** Изображение активного portrait variant.
- [ ] **IMG-006 — V1.** Отдельное изображение для hover preview.
- [ ] **IMG-007 — V1.** Fallback при недоступном/удалённом файле.
- [ ] **IMG-008 — V1.** Поддержать форматы изображений и видео, безопасно поддерживаемые Foundry/browser.

### 7.3. Раздельное изменение документов

В редакторе смены изображения операции должны быть независимы:

- [ ] **IMG-UPD-001 — V1.** Изменить только сценический портрет RN Portrait Stage.
- [ ] **IMG-UPD-002 — V1.** Изменить `Actor.img`.
- [ ] **IMG-UPD-003 — V1.** Изменить `prototypeToken.texture.src`.
- [ ] **IMG-UPD-004 — V1.** Изменить конкретный связанный TokenDocument.
- [ ] **IMG-UPD-005 — Later.** Изменить все подходящие токены Actor на активной сцене.
- [ ] **IMG-UPD-006 — V1.** Перед массовым изменением показывать список затрагиваемых документов.

---

## 8. Управление составом сцены

### 8.1. Добавление

- [ ] **CAST-001 — MVP.** Drag-and-drop Actor на группу.
- [ ] **CAST-002 — MVP.** Добавление через отдельный менеджер состава.
- [ ] **CAST-003 — V1.** Пункт контекстного меню Actor Directory.
- [ ] **CAST-004 — V1.** Добавление через публичный API.
- [ ] **CAST-005 — V1.** При переносе Token предлагать связать конкретный Token UUID.

### 8.2. Удаление и порядок

- [ ] **CAST-010 — MVP.** Удаление записи без удаления Actor/Token.
- [ ] **CAST-011 — MVP.** Ручное изменение порядка drag-and-drop.
- [ ] **CAST-012 — MVP.** Перенос между PC/NPC группами.
- [ ] **CAST-013 — V1.** Массовое скрытие/показ группы.
- [ ] **CAST-014 — V1.** Очистка сцены с подтверждением.
- [ ] **CAST-015 — V1.** Undo последнего изменения состава в текущем клиентском сеансе.

### 8.3. Автоматические предложения

- [ ] **CAST-020 — Later.** Добавить всех player-owned Actor.
- [ ] **CAST-021 — Later.** Добавить Actor из tokens активной сцены.
- [ ] **CAST-022 — Later.** Разделить найденных Actor на PC/NPC по адаптеру системы.
- [ ] **CAST-023 — Later.** Автоматизация никогда не должна менять сохранённый состав без подтверждения GM.

---

## 9. Hover-поведение

### 9.1. Общая модель

- [ ] **HOVER-001 — MVP.** Hover работает без TokenDocument.
- [ ] **HOVER-002 — MVP.** Hover не требует canvas ready для базового отображения.
- [ ] **HOVER-003 — MVP.** Каждый тип поведения можно включать независимо.
- [ ] **HOVER-004 — V1.** Hover корректно завершается при перерендере/удалении портрета.
- [ ] **HOVER-005 — V1.** Асинхронный provider не должен показать устаревшие данные после ухода курсора.
- [ ] **HOVER-006 — V1.** Поддержать задержку открытия и закрытия.

### 9.2. Встроенные hover-возможности

- [ ] **HOVER-010 — MVP.** Визуальная подсветка самого портрета.
- [ ] **HOVER-011 — MVP.** Отображение имени с соблюдением видимости.
- [ ] **HOVER-012 — V1.** Hover preview увеличенного изображения.
- [ ] **HOVER-013 — V1.** Настраиваемый источник hover preview: module/Actor/Token/custom.
- [ ] **HOVER-014 — V1.** Настраиваемое положение hover preview.
- [ ] **HOVER-015 — V1.** Приглушение остальных портретов.
- [ ] **HOVER-016 — V1.** Показ универсальных Active Effects.
- [ ] **HOVER-017 — V1.** Выполнение назначенного макроса при enter/leave с предупреждением о рисках.

### 9.3. Подсветка связанного токена

- [ ] **TOKEN-HOVER-001 — V1.** Функция выключена или включена отдельной настройкой.
- [ ] **TOKEN-HOVER-002 — V1.** При наличии `tokenUuid` подсвечивать именно этот токен.
- [ ] **TOKEN-HOVER-003 — V1.** Если есть только Actor UUID, применять настраиваемую стратегию: `none`, `first`, `all`.
- [ ] **TOKEN-HOVER-004 — V1.** Не изменять control/target состояния токена.
- [ ] **TOKEN-HOVER-005 — V1.** Не снимать подсветку, установленную другим источником.
- [ ] **TOKEN-HOVER-006 — V1.** Если canvas/token отсутствует, тихо продолжать остальные hover-действия.
- [ ] **TOKEN-HOVER-007 — V1.** Реализацию Foundry highlight изолировать в compatibility adapter v13/v14.

### 9.4. Расширяемые hover blocks

Предполагаемый контракт:

```js
api.hover.registerBlock({
  id: "package.block-id",
  label: "Localized label",
  packageId: "package-id",
  systems: ["system-id"],
  isAvailable: context => true,
  getData: async context => ({}),
  render: async context => HTMLElement
});
```

- [ ] **HOVER-EXT-001 — V1.** Уникальный namespaced ID.
- [ ] **HOVER-EXT-002 — V1.** Регистрация до `ready` или во время специального init hook.
- [ ] **HOVER-EXT-003 — V1.** Настройка включения provider глобально и для конкретного портрета.
- [ ] **HOVER-EXT-004 — V1.** Catch/log ошибок каждого provider отдельно.
- [ ] **HOVER-EXT-005 — V1.** Передавать context: user, actor, token, scene, portrait, entry, element, event, signal.
- [ ] **HOVER-EXT-006 — V1.** Передавать `AbortSignal` для отмены асинхронной подготовки.
- [ ] **HOVER-EXT-007 — V1.** Не разрешать скрытым блокам получать/рендерить данные без `isAvailable`/permission-проверки.
- [ ] **HOVER-EXT-008 — Later.** Структурированные безопасные компоненты вместо обязательного сырого HTML.

---

## 10. Действия и кнопки портрета

### 10.1. Размещение

- [ ] **ACT-001 — V1.** Действие может находиться под портретом постоянно.
- [ ] **ACT-002 — V1.** Действие может появляться только при hover.
- [ ] **ACT-003 — V1.** Действие может находиться в context menu.
- [ ] **ACT-004 — V1.** Действие может быть только для GM или owner.
- [ ] **ACT-005 — V1.** Для группы можно ограничить количество видимых кнопок и убирать остальные в меню.

### 10.2. API регистрации

```js
api.actions.register({
  id: "package.action-id",
  label: "Localized label",
  icon: "fa-solid fa-tags",
  placement: ["hover", "context"],
  isVisible: context => true,
  isEnabled: context => true,
  execute: async context => {}
});
```

- [ ] **ACT-010 — V1.** Namespaced ID.
- [ ] **ACT-011 — V1.** Отдельные `isVisible` и `isEnabled`.
- [ ] **ACT-012 — V1.** Повторная проверка при `execute`.
- [ ] **ACT-013 — V1.** Обработка loading state и двойного клика.
- [ ] **ACT-014 — V1.** Ошибка одного action не ломает карточку.
- [ ] **ACT-015 — Later.** Toggle actions с состояниями active/inactive.

### 10.3. Встроенные действия

- [ ] **ACT-020 — MVP.** Открыть Actor Sheet при разрешении.
- [ ] **ACT-021 — MVP.** Удалить портрет из сцены (GM).
- [ ] **ACT-022 — MVP.** Открыть настройки записи (GM).
- [ ] **ACT-023 — V1.** Переключить вариант портрета.
- [ ] **ACT-024 — V1.** Сменить изображение.
- [ ] **ACT-025 — Experimental.** GM: выбрать портрет как текущего озвучиваемого персонажа.
- [ ] **ACT-026 — Experimental.** GM: включить/выключить маршрутизацию speaking state.

---

## 11. Варианты и пресеты портретов

### 11.1. Portrait variant

```js
{
  id: "angry",
  label: "Angry",
  image: {
    source: "custom",
    src: "portraits/hero-angry.webp"
  },
  actorUpdates: {},
  prototypeTokenUpdates: {},
  tokenUpdates: {},
  activeEffects: [],
  portraitEffects: [],
  integrations: []
}
```

- [x] **VAR-001 — V1.** Вариант обязательно имеет ID, label и image source.
- [x] **VAR-002 — V1.** Варианты хранятся в flags Actor; запись состава содержит только active variant ID.
- [ ] **VAR-003 — V1.** Применение изображения RN Portrait Stage независимо от обновления Actor/Token.
- [ ] **VAR-004 — V1.** Дополнительные обновления выключены по умолчанию.
- [ ] **VAR-005 — V1.** Показывать preview всех изменений перед сохранением опасного пресета.
- [ ] **VAR-006 — V1.** Whitelist разрешённых путей обновления.
- [ ] **VAR-007 — V1.** System adapter может валидировать свои update paths.
- [ ] **VAR-008 — Later.** Добавление/удаление Active Effects.
- [ ] **VAR-009 — Later.** Integration actions.
- [ ] **VAR-010 — V1.** API применения варианта доступен макросам.

### 11.2. Scene cast preset

- [ ] **PRESET-001 — V1.** Сохранять состав обеих групп.
- [ ] **PRESET-002 — V1.** Сохранять порядок.
- [ ] **PRESET-003 — V1.** Сохранять активные варианты.
- [ ] **PRESET-004 — V1.** Опционально сохранять group layout.
- [ ] **PRESET-005 — V1.** Загружать с режимом `replace` или `merge`.
- [ ] **PRESET-006 — V1.** Предупреждать о потерянных UUID.
- [ ] **PRESET-007 — Later.** Экспорт/импорт JSON.
- [ ] **PRESET-008 — V1.** Создавать макрос вызова пресета.

---

## 12. Хранение данных

### 12.1. Scene flags

Основной состав активной сцены:

```js
scene.flags["rn-portrait-stage"] = {
  schemaVersion: 3,
  layout: { pcPortraitSize: null, npcPortraitSize: null },
  groups: {
    pcs: {
      entries: []
    },
    npcs: {
      entries: []
    }
  }
};
```

- [x] **DATA-001 — MVP.** Состав сцены хранить в Scene flags.
- [x] **DATA-002 — MVP.** Не хранить копии Actor data.
- [x] **DATA-003 — MVP.** Каждая структура имеет `schemaVersion`.
- [ ] **DATA-004 — V1.** Обновления Scene flags выполняет уполномоченный пользователь.
- [ ] **DATA-005 — V1.** Избегать race condition при одновременном редактировании.

### 12.2. Settings scopes

- [ ] **DATA-010 — MVP.** `world`: права игроков, общие defaults и feature flags.
- [ ] **DATA-011 — MVP.** `user`: персональные размеры/видимость/раскладка, если v13/v14 API поддерживает scope одинаково.
- [ ] **DATA-012 — MVP.** `client`: только device-specific параметры при необходимости.
- [ ] **DATA-013 — V1.** UI явно показывает, применяется настройка ко всем или только текущему пользователю.
- [ ] **DATA-014 — V1.** World setting не использовать для часто меняющегося speaking state.

### 12.3. Actor flags

- [x] **DATA-020 — V1.** Библиотека вариантов и основная подпись хранятся в Actor flags.
- [x] **DATA-021 — V1.** Не изменять Actor flags без полномочий владельца/GM.
- [ ] **DATA-022 — V1.** Поддержать compendium actors только в read-only/fallback-режиме либо явно документировать ограничение.

### 12.4. Миграции

- [x] **DATA-030 — V1.** Реестр миграций по `schemaVersion`.
- [ ] **DATA-031 — V1.** Миграция идемпотентна.
- [ ] **DATA-032 — V1.** Перед необратимой массовой миграцией выводить предупреждение GM.
- [ ] **DATA-033 — V1.** Не удалять неизвестные flags сторонних extensions.

---

## 13. Синхронизация между клиентами

- [ ] **SYNC-001 — MVP.** Изменения Scene/Actor/Token документов распространяются стандартной синхронизацией Foundry.
- [ ] **SYNC-002 — MVP.** Клиенты реагируют на update Scene/Actor/Token hooks без полной перезагрузки.
- [ ] **SYNC-003 — V1.** Временные состояния не сохранять в Scene flags.
- [ ] **SYNC-004 — V1.** Для временных событий использовать module socket.
- [ ] **SYNC-005 — V1.** Каждое socket-сообщение валидировать по типу, версии и полномочиям отправителя.
- [ ] **SYNC-006 — V1.** Не доверять входящему `actorUuid` без проверки видимости/назначения.
- [ ] **SYNC-007 — V1.** Поздно подключившийся клиент получает актуальное постоянное состояние из документов.
- [ ] **SYNC-008 — Experimental.** Speaking state имеет timestamp и автоматически истекает.

---

## 14. Собственный движок визуальных эффектов

### 14.1. Архитектурная основа

- [ ] **FX-001 — MVP/Foundation.** Определить versioned schema эффекта, даже если доступен только базовый CSS renderer.
- [ ] **FX-002 — MVP/Foundation.** Реестр effect engines.
- [ ] **FX-003 — MVP/Foundation.** Жизненный цикл `play`, `update`, `stop`, `destroy`.
- [ ] **FX-004 — MVP/Foundation.** Триггеры `hover`, `speaking`, `selected`, `active-turn`, `manual`, `portrait-change`, `always`.
- [ ] **FX-005 — MVP/Foundation.** Очистка эффектов при удалении/перерендере записи.
- [ ] **FX-006 — V1.** Одновременные эффекты и приоритеты.
- [ ] **FX-007 — V1.** Уважать `prefers-reduced-motion`.
- [ ] **FX-008 — V1.** Клиентская настройка отключения эффектов.

### 14.2. CSS engine

- [ ] **FX-CSS-001 — V1.** Glow.
- [ ] **FX-CSS-002 — V1.** Pulse.
- [ ] **FX-CSS-003 — V1.** Speaking outline.
- [ ] **FX-CSS-004 — V1.** Brightness/contrast/grayscale/hue/blur.
- [ ] **FX-CSS-005 — V1.** Shake/float.
- [ ] **FX-CSS-006 — V1.** Fade/slide portrait transition.
- [ ] **FX-CSS-007 — V1.** Не позволять нескольким эффектам некорректно перезаписывать общий `filter`.

### 14.3. Будущие engines

- [ ] **FX-OVERLAY-001 — Later.** Image/video overlays перед и за портретом.
- [ ] **FX-SVG-001 — Later.** SVG filters/masks.
- [ ] **FX-PIXI-001 — Later.** PIXI/WebGL renderer для сложных shader effects.
- [ ] **FX-PIXI-002 — Later.** Ограничение одновременно активных WebGL-портретов.
- [ ] **FX-EXT-001 — Later.** API регистрации движка сторонним модулем.

### 14.4. Сторонние FX-модули

- [ ] **FX-THIRD-001.** TokenMagic не является зависимостью.
- [ ] **FX-THIRD-002.** FXMaster не является зависимостью.
- [ ] **FX-THIRD-003.** Не использовать их внутренние классы как основу renderer.
- [ ] **FX-THIRD-004 — Later.** Необязательные bridge/import adapters допускаются только при наличии конкретного сценария и стабильного API.

---

## 15. Experimental: Voice-Activated Portrait

### 15.1. Назначение

Функция локально анализирует уровень сигнала выбранного микрофона и синхронизирует только булево speaking state. Аудио не должно записываться, сохраняться или отправляться модулем.

- [ ] **VOICE-001 — Experimental.** Функция полностью выключена по умолчанию.
- [ ] **VOICE-002 — Experimental.** Пометка «Экспериментальная» во всех настройках.
- [ ] **VOICE-003 — Experimental.** Ясное описание приватности перед запросом микрофона.
- [ ] **VOICE-004 — Experimental.** Использовать `getUserMedia({audio: true, video: false})`.
- [ ] **VOICE-005 — Experimental.** Анализ через Web Audio `AnalyserNode`.
- [ ] **VOICE-006 — Experimental.** Не подключать анализируемый stream к audio destination.
- [ ] **VOICE-007 — Experimental.** Не использовать Foundry AV как обязательный backend.

### 15.2. Требования окружения

- [ ] **VOICE-010.** Проверять наличие secure context.
- [ ] **VOICE-011.** Поддерживаемые origin: HTTPS либо localhost согласно браузеру.
- [ ] **VOICE-012.** При HTTP remote origin показывать понятное сообщение о невозможности доступа к микрофону.
- [ ] **VOICE-013.** Запрашивать permission только после явного действия пользователя.
- [ ] **VOICE-014.** Обрабатывать denied, missing device, device busy и track ended.

### 15.3. Назначение User → Actor

- [ ] **VOICE-020.** Один обычный Foundry User назначается максимум одному Actor.
- [ ] **VOICE-021.** Назначение задаётся GM.
- [ ] **VOICE-022.** При отсутствии назначения speaking events игнорируются.
- [ ] **VOICE-023.** GM может выбрать временный `currentlyVoicedActorUuid`.
- [ ] **VOICE-024.** GM может включать/выключать маршрутизацию своего speaking state.
- [ ] **VOICE-025.** Смена GM Actor завершает speaking state предыдущего портрета.

### 15.4. Детектор

- [ ] **VOICE-030.** Настраиваемый threshold.
- [ ] **VOICE-031.** Настраиваемый attack delay.
- [ ] **VOICE-032.** Настраиваемый release delay.
- [ ] **VOICE-033.** Минимальная длительность speaking для подавления коротких шумов.
- [ ] **VOICE-034.** Тестовый индикатор уровня без сетевой отправки.
- [ ] **VOICE-035.** Выбор устройства ввода, если browser разрешает enumerate devices.
- [ ] **VOICE-036.** Корректная реакция на смену/отключение устройства.

### 15.5. Сеть и очистка

- [ ] **VOICE-040.** Передавать только `userId`, `actorUuid`, `speaking`, `timestamp`, `protocolVersion`.
- [ ] **VOICE-041.** Ограничивать частоту socket events переходами состояния и heartbeat.
- [ ] **VOICE-042.** Auto-timeout снимает залипшее speaking state.
- [ ] **VOICE-043.** При disable/logout/reload вызывать `track.stop()` и закрывать AudioContext.
- [ ] **VOICE-044.** Speaking effect является настраиваемым portrait effect preset.
- [ ] **VOICE-045.** Локальная настройка позволяет не показывать voice effects.

---

## 16. Настройки модуля

### 16.1. World settings

- [ ] Разрешить владельцам менять сценический портрет.
- [ ] Разрешить владельцам применять варианты.
- [ ] Разрешить обновление Actor/Prototype Token через вариант.
- [ ] Значения группы по умолчанию.
- [ ] Default hover blocks/actions.
- [ ] Включить экспериментальную voice-функцию для мира.
- [ ] User → Actor voice assignments.
- [ ] Debug logging.

### 16.2. User settings

- [ ] Показать/скрыть модуль.
- [ ] Размер портретов.
- [ ] Spacing и offsets, если разрешена персональная раскладка.
- [ ] Направление групп.
- [ ] Показывать hover preview.
- [ ] Показывать эффекты.
- [ ] Reduced motion override.
- [ ] Включить локальный voice detector.
- [ ] Microphone device и detector threshold.

### 16.3. Scene configuration

- [ ] Состав групп.
- [ ] Порядок.
- [ ] Видимость отдельных записей.
- [ ] Активные варианты.
- [ ] Scene-specific layout override.
- [ ] Scene-specific hover defaults.

---

## 17. Публичный API

Предполагаемый доступ:

```js
const api = game.modules.get("rn-portrait-stage")?.api;
```

### 17.1. Управление портретами

```js
await api.portraits.show(actorUuid, options);
await api.portraits.hide(entryIdOrActorUuid, options);
await api.portraits.move(entryId, groupId, sort);
await api.portraits.update(entryId, changes);
await api.portraits.clear({ scene, groupId });
```

- [ ] **API-001 — V1.** Методы возвращают Promise с документированным результатом.
- [ ] **API-002 — V1.** Методы валидируют полномочия.
- [ ] **API-003 — V1.** API не раскрывает изменяемые внутренние коллекции напрямую.
- [ ] **API-004 — V1.** Публичный API получает `apiVersion`.

### 17.2. Варианты и пресеты

```js
await api.variants.apply(entryIdOrActorUuid, variantId, options);
await api.presets.save(name, options);
await api.presets.load(name, { mode: "replace" });
await api.presets.remove(name);
```

### 17.3. Расширения

```js
api.hover.registerBlock(definition);
api.actions.register(definition);
api.effects.registerPreset(definition);
api.effects.registerEngine(id, engine);
api.images.registerResolver(definition);
```

### 17.4. Voice

```js
await api.voice.setGmActor(actorUuid);
await api.voice.setGmRouting(enabled);
api.voice.getState();
```

Ручная установка `speaking` внешним кодом может быть добавлена позднее, но должна требовать доверенного контекста и иметь timeout.

---

## 18. Hooks

Предварительный список:

```js
Hooks.callAll("rnPortraitStageReady", api);
Hooks.callAll("rnPortraitStagePortraitRender", context);
Hooks.callAll("rnPortraitStageHoverIn", context);
Hooks.callAll("rnPortraitStageHoverOut", context);
Hooks.callAll("rnPortraitStageVariantApplied", context);
Hooks.callAll("rnPortraitStageSpeakingChanged", context);
```

- [ ] **HOOK-001 — V1.** Документировать, какие hooks cancellable.
- [ ] **HOOK-002 — V1.** Не ожидать async-результат от обычных Foundry Hooks.
- [ ] **HOOK-003 — V1.** Для async extensions использовать собственные registry callbacks.
- [ ] **HOOK-004 — V1.** Context hooks не должен позволять незаметно мутировать сохранённую запись.

---

## 19. ApplicationV2 и окна

- [ ] **APP-001 — MVP.** Использовать ApplicationV2 для менеджера состава.
- [ ] **APP-002 — MVP.** Использовать ApplicationV2 для редактора записи.
- [ ] **APP-003 — V1.** ApplicationV2 для редактора вариантов.
- [ ] **APP-004 — V1.** ApplicationV2 для настроек voice detector.
- [ ] **APP-005.** Постоянные группы портретов могут быть управляемыми DOM-компонентами и не обязаны быть плавающими окнами ApplicationV2.
- [ ] **APP-006.** Шаблоны и parts разделять по ответственности.
- [ ] **APP-007.** Не создавать отдельное окно на каждый портрет.

---

## 20. Предлагаемая структура исходников

```text
rn-portrait-stage/
  module.json
  README.md
  CHANGELOG.md
  LICENSE
  lang/
    en.json
    ru.json
  styles/
    rn-portrait-stage.css
  templates/
    portrait.hbs
    portrait-group.hbs
    cast-manager.hbs
    portrait-editor.hbs
  scripts/
    main.js
    api.js
    constants.js
    settings.js
    data/
      scene-state.js
      migrations.js
      validators.js
    portraits/
      portrait-controller.js
      portrait-group.js
      image-resolvers.js
    hover/
      hover-controller.js
      hover-registry.js
      core-blocks.js
    actions/
      action-registry.js
      core-actions.js
    effects/
      effect-controller.js
      effect-registry.js
      css-engine.js
    apps/
      cast-manager.js
      portrait-editor.js
      variant-editor.js
    compatibility/
      foundry-v13.js
      foundry-v14.js
      ui-anchors.js
      token-highlight.js
    voice/
      voice-controller.js
      microphone-detector.js
      voice-socket.js
    integrations/
      integration-registry.js
  docs/
    TECHNICAL_SPECIFICATION.md
    API.md
    INTEGRATIONS.md
```

Структура предварительная и может быть упрощена для MVP. Не следует создавать пустые файлы только ради соответствия схеме.

---

## 21. Локализация и доступность

- [ ] **A11Y-001 — MVP.** Английская и русская локализация.
- [ ] **A11Y-002 — MVP.** Пользовательский текст не зашивать в JS/HBS.
- [ ] **A11Y-003 — V1.** Keyboard focus для портретов и действий.
- [ ] **A11Y-004 — V1.** Hover-содержимое также доступно через focus.
- [ ] **A11Y-005 — V1.** Корректные accessible labels без раскрытия скрытого имени.
- [ ] **A11Y-006 — V1.** Не полагаться только на цвет.
- [ ] **A11Y-007 — V1.** Reduced motion.
- [ ] **A11Y-008 — V1.** Достаточный контраст встроенных контролов.

---

## 22. Производительность

- [ ] **PERF-001 — MVP.** Не выполнять постоянный polling Actor/Scene state.
- [ ] **PERF-002 — MVP.** Реагировать на Foundry hooks и точечные изменения.
- [ ] **PERF-003 — V1.** Кэшировать вычисления hover provider только в пределах безопасного lifecycle.
- [ ] **PERF-004 — V1.** Отменять асинхронный hover через AbortController.
- [ ] **PERF-005 — V1.** Не перерендеривать все портреты при изменении одного Actor без необходимости.
- [ ] **PERF-006 — V1.** Lazy-load hover preview и тяжёлые изображения.
- [ ] **PERF-007 — V1.** Не запускать hidden animations.
- [ ] **PERF-008 — Experimental.** Voice analyser использует разумный interval и не требует 60 FPS.
- [ ] **PERF-009 — Later.** Лимиты WebGL/particle effects.

---

## 23. Обработка ошибок и диагностика

- [ ] **ERR-001 — MVP.** Понятное placeholder-состояние потерянного Actor.
- [ ] **ERR-002 — MVP.** Понятный fallback отсутствующего изображения.
- [ ] **ERR-003 — MVP.** Ошибка одной записи не ломает группу.
- [ ] **ERR-004 — V1.** Namespaced logger с debug setting.
- [ ] **ERR-005 — V1.** Не спамить одинаковыми notifications.
- [ ] **ERR-006 — V1.** Ошибки extension содержат ID и packageId.
- [ ] **ERR-007 — V1.** Диагностическая информация: Foundry version, system ID/version, module version, schemaVersion.
- [ ] **ERR-008 — Experimental.** Voice diagnostics не содержат и не сохраняют audio samples.

---

## 24. Безопасность

- [ ] **SEC-001 — MVP.** Не вставлять непроверенный HTML через `innerHTML`.
- [ ] **SEC-002 — V1.** Санитизировать или ограничивать HTML сторонних providers.
- [ ] **SEC-003 — V1.** Не выполнять строковый JavaScript из пресетов.
- [ ] **SEC-004 — V1.** Макросы хранят UUID и запускаются только по явной настройке/действию.
- [ ] **SEC-005 — V1.** Socket payload имеет allowlist полей и ограничение размера.
- [ ] **SEC-006 — V1.** Document updates проходят schema validation и permission checks.
- [ ] **SEC-007 — Experimental.** Microphone начинается только после осознанного согласия пользователя.
- [ ] **SEC-008 — Experimental.** UI всегда показывает активность voice detector и позволяет немедленно его остановить.

---

## 25. Тестирование

### 25.1. Матрица

Минимальная ручная матрица:

| Foundry | Роль | Canvas | Sidebar | Проверка |
|---|---|---|---|---|
| v13 | GM | включён | закрыт | обе группы, DnD, настройки |
| v13 | GM | включён | открыт | правый anchor и отсутствие перекрытий |
| v13 | Player | включён | любой | permissions и ownership |
| v13 | Player | отключён | любой | портреты без canvas/token |
| v14 | GM | включён | закрыт | compatibility/UI anchors |
| v14 | Player | включён | открыт | permissions/hover |

Дополнительно:

- минимум две разные игровые системы;
- сцена без tokens;
- один Actor с несколькими tokens;
- удалённый Actor;
- скрытый NPC;
- 20+ портретов;
- reconnect клиента;
- изменение active scene;
- 1280×720 и 1920×1080;
- voice over HTTPS, localhost и неподдерживаемый HTTP origin.

### 25.2. Автоматические проверки

- [x] **TEST-001 — MVP.** JSON validation `module.json`, `lang/en.json`, `lang/ru.json`.
- [x] **TEST-002 — MVP.** JavaScript syntax checks.
- [ ] **TEST-003 — V1.** Unit tests validators/migrations.
- [ ] **TEST-004 — V1.** Unit tests registry duplicate IDs и error isolation.
- [ ] **TEST-005 — V1.** Unit tests scene state serialization.
- [ ] **TEST-006 — V1.** Lint/format check.
- [ ] **TEST-007 — V1.** `git diff --check` перед релизом.

---

## 26. Критерии готовности релизов

### 26.1. Milestone 0 — Foundation

- [x] module manifest и загрузка ES module;
- [x] русская/английская локализация;
- [x] settings registration;
- [~] compatibility layer v13/v14 — v13 проверена, runtime-проверка v14 отложена;
- [x] базовая schema Scene flags;
- [x] публичный API skeleton;
- [x] effect schema/registry skeleton.

### 26.2. Milestone 1 — MVP: Scene Portraits

- [~] левая PC и правая NPC группы — код готов, требуется v13 smoke-test;
- [~] добавление Actor через менеджер/drag-and-drop — код готов, требуется v13 smoke-test;
- [~] удаление, сортировка и перенос между группами — код готов, требуется v13 smoke-test;
- [~] Actor/custom/prototype-token image source — код готов, требуется v13 smoke-test;
- [~] Scene persistence — код готов, требуется v13 smoke-test;
- [~] размеры, spacing, offsets и направление — код готов, требуется визуальная проверка v13;
- [~] открытие Actor Sheet — код готов, требуется v13 smoke-test;
- [~] GM/player permissions — код готов, требуется проверка GM и Player;
- [~] работа без canvas и tokens — архитектурно поддерживается, требуется ручная проверка;
- [~] ручная проверка v13/v14 — v13 ожидает проверки; v14 отложена по решению пользователя.
- [~] постоянный и сценовый слои состава с приоритетом сценовой записи — код готов, требуется v13 smoke-test;
- [~] варианты Actor, подписи и общий размер через менеджер — код готов, требуется v13 smoke-test;
- [~] адаптивная NPC-колонка, резервирующая область мини-чата и уведомлений — код готов, требуется v13 визуальная проверка.

### 26.3. Milestone 2 — Hover and Extensions

- [ ] hover preview;
- [ ] optional token highlight;
- [ ] hover block registry;
- [ ] action registry;
- [ ] core hover blocks/actions;
- [ ] документированный пример системной интеграции;
- [ ] базовая `litm-rn` интеграция или отдельный план её реализации.

### 26.4. Milestone 3 — Variants and Presets

- [~] variant editor — базовая библиотека вариантов реализована раньше milestone, расширенные действия отложены;
- [ ] безопасное применение image/document changes;
- [ ] scene cast presets;
- [ ] macro API;
- [ ] экспорт/импорт либо документированное отложенное решение.

### 26.5. Milestone 4 — Portrait FX

- [ ] CSS effect engine;
- [ ] hover/speaking/manual triggers;
- [ ] preset editor;
- [ ] синхронизация GM-triggered effects;
- [ ] reduced motion и performance limits.

### 26.6. Milestone 5 — Experimental Voice

- [ ] consent/settings UI;
- [ ] local microphone analyser;
- [ ] User → Actor assignment;
- [ ] GM voiced Actor controls;
- [ ] socket speaking states и timeout;
- [ ] speaking portrait effect;
- [ ] документация HTTPS/privacy/limitations.

### 26.7. Milestone 6 — Flexible Docking

- [ ] row/column layout;
- [ ] все направления;
- [ ] anchor picker;
- [ ] drag positioning;
- [ ] устойчивые fallbacks при изменении Foundry UI.

---

## 27. Definition of Done для отдельной функции

Пункт считается выполненным только если:

1. Реализация соответствует ТЗ или ТЗ предварительно обновлено.
2. Проверены права GM и игрока.
3. Проверено отсутствие связанного Token, если функция относится к Actor/portrait.
4. UI-текст локализован на русский и английский.
5. Ошибки обрабатываются без поломки всего интерфейса.
6. Нет утечки слушателей, timers, MediaStream или PIXI/DOM resources.
7. Проверено хотя бы на одной поддерживаемой версии Foundry; перед релизом — на обеих.
8. Добавлена или обновлена пользовательская/API-документация.
9. Выполнены относящиеся к функции автоматические и ручные проверки.

---

## 28. Открытые вопросы

Эти решения нужно принять до соответствующего milestone:

- [x] **Q-001.** Portrait variants хранятся в Actor flags.
- [x] **Q-002.** Поддерживаются два слоя: постоянный мировой и scene-specific; сценовая запись переопределяет постоянную.
- [ ] **Q-003.** Разрешать ли несколько записей одного Actor в одной группе?
- [ ] **Q-004.** Какой default для Actor с несколькими tokens: не подсвечивать, первый или все?
- [ ] **Q-005.** Какие hover blocks считаются безопасными универсальными Active Effects?
- [ ] **Q-006.** Разрешать ли raw HTMLElement сторонним providers в V1 или начать только со структурированных компонентов?
- [ ] **Q-007.** Как сохранять пользовательскую раскладку относительно world defaults?
- [x] **Q-008.** Реализован постоянный мировой состав, объединяемый с составом активной Scene.
- [ ] **Q-009.** Должен ли GM speaking state быть виден на своём клиенте при выключенной сетевой трансляции?
- [ ] **Q-010.** Нужна ли поддержка video portraits уже в MVP?
- [ ] **Q-011.** Нужна ли отмена применения portrait variant, изменившего Actor/Token?
- [ ] **Q-012.** Должен ли preset хранить layout или только состав/варианты?

---

## 29. Журнал решений

### 2026-08-21

- Выбрано рабочее название **RN Portrait Stage** и ID `rn-portrait-stage`.
- Целевые версии: Foundry VTT v13 и v14.
- Модуль должен быть системно-агностичным.
- PC по умолчанию размещаются в `#ui-left-column-2`, NPC — в `#ui-right-column-1`.
- Наличие Token на сцене не является обязательным.
- Библиотеки вариантов и основные подписи сохраняются в Actor flags.
- Состав имеет постоянный мировой и сценовый слои; сценовая запись Actor имеет приоритет.
- Нижняя граница NPC-колонки вычисляется по фактическому положению мини-чата и уведомлений.
- NPC-группа абсолютно позиционируется внутри `#ui-right-column-1`, не участвует в потоке и при переполнении создаёт новые колонки влево без прокрутки.
- PC-портреты автоматически уменьшаются, если одна колонка не помещается по высоте окна.
- Наличие записей в составе не означает их показ: GM отдельно включает или выключает мировое отображение портретов.
- В библиотеке Actor всегда существуют неудаляемые варианты портрета Actor и изображения prototype Token; остальные варианты являются кастомными изображениями.
- Размеры PC и NPC задаются независимо; настройка хранится в сценовом layout.
- Постоянство задаётся для каждой записи отдельно; новые PC постоянны по умолчанию, новые NPC относятся к текущей сцене.
- Менеджер содержит мировой «Резерв» компактных portrait-entry плиток с двусторонним drag-and-drop и сохранением варианта/отражения/видимости/предпочтения постоянства.
- Действия «Настроить», «Убрать», «Отразить», «Сохранять между сценами» и «Скрыть/показать» находятся на карточках менеджера, а не на сценических портретах.
- Dropdown шрифта строится из шрифтов, зарегистрированных в текущем мире через Foundry FontConfig/CONFIG.
- Настройка шрифта регистрируется на `ready`, после расширений `CONFIG.fontDefinitions` другими модулями (включая `ru-ru`).
- Portrait editor сохраняет изменения немедленно; отдельной кнопки Save нет.
- Основная подпись Actor имеет режимы: Actor name, Prototype Token name, hidden и custom.
- Активный вариант выбирается на конкретной записи; настройка default variant не показывается пользователю.
- На сценическом портрете владельцу доступны только Configure (сверху справа) и Change Portrait (снизу справа); второе открывает activation-only picker.
- Порядок является единым для scene/persistent слоёв и не меняется при переключении «Сохранять между сценами».
- Подсветка связанного Token при hover является опциональной функцией.
- Системные hover-данные и кнопки добавляются через публичные registries/API.
- TokenMagic и FXMaster не являются зависимостями.
- Закладывается собственный versioned portrait FX engine; сложные эффекты реализуются позднее.
- Voice activation должна работать через локальный анализ микрофона без передачи аудио и помечаться Experimental.
- Обычному Foundry User назначается один Actor для speaking portrait; GM может временно выбирать любого Actor.
- Реализован код Milestone 0 Foundation версии `0.1.0`: manifest/bootstrap, локализации, настройки, schema/migrations, API и effect registries, compatibility adapters.
- Статические проверки и foundation unit tests пройдены; Foundation smoke-test v13 пройден, v14 отложен.
- Foundation успешно запущен в Foundry v13: настройки зарегистрированы, ошибок первого запуска нет.
- Реализован код Milestone 1 версии `0.2.0`; перед git-коммитом требуется пройти `docs/MILESTONE_1_TESTING.md`.
- Добавление Actor через drag-and-drop выполняется только внутри открытого менеджера. Модуль не перехватывает штатный drop Actor на canvas.
- Кнопка открытия менеджера располагается справа от Scene Navigation, а не в Scene Controls.
- Группы портретов вставляются непосредственно в `#ui-left-column-2` и `#ui-right-column-1`, а не в отдельный fixed overlay.
- При наличии видимых PC `#ui-left-column-2` расширяется в горизонтальную раскладку: портреты слева, Scene Navigation справа. Без PC колонка возвращается к штатной ширине.
- Кнопка менеджера и управляющие элементы портретов видимы только GM.
- Все Actor, явно добавленные GM на Portrait Stage, показываются игрокам независимо от ownership; permission продолжает ограничивать открытие Actor Sheet и будущие системные hover-данные.

---

## 30. Идеи вне утверждённого scope

Этот раздел предназначен для сохранения идей без автоматического превращения их в обязательные требования.

- Анимации входа/выхода персонажей как в visual novel.
- Несколько визуальных тем рамок.
- Автосмена портрета по Active Effect или значению ресурса.
- Интеграция с combat turn.
- Отдельный presentation mode без остального UI Foundry.
- Групповые сцены/подгруппы NPC.
- Portrait playlists или последовательности выражений.
- Интеграции с system-specific chat speaker.
- Импорт вариантов из структуры каталогов.
- Companion-интеграция с Discord в отдалённом будущем.
