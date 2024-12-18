import {
  App,
  Editor,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";

interface TaskOrganizerSettings {
  organizerOnSave: boolean;
  keepSubtasksWithParent: boolean;
}

const DEFAULT_SETTINGS: TaskOrganizerSettings = {
  organizerOnSave: true,
  keepSubtasksWithParent: true,
};

export default class TaskOrganizerPlugin extends Plugin {
  settings: TaskOrganizerSettings;

  async onload() {
    await this.loadSettings();

    // Add command to organize tasks
    this.addCommand({
      id: "organize-tasks",
      name: "Organize Tasks",
      editorCallback: (editor: Editor) => this.organizeTasks(editor),
    });

    // Add settings tab
    this.addSettingTab(new TaskOrganizerSettingTab(this.app, this));

    // Register event handler for file save
    if (this.settings.organizerOnSave) {
      this.registerEvent(
        this.app.workspace.on("editor-change", () => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view) {
            this.organizeTasks(view.editor);
          }
        })
      );
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  organizeTasks(editor: Editor) {
    const content = editor.getValue();
    const organized = this.organizeTaskContent(content);

    if (organized !== content) {
      const cursor = editor.getCursor();
      editor.setValue(organized);
      editor.setCursor(cursor);
    }
  }

  organizeTaskContent(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    const taskGroups: Map<
      number,
      { incomplete: string[]; completed: string[] }
    > = new Map();

    let currentIndent = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const taskMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)$/);

      if (taskMatch) {
        const indent = taskMatch[1].length;
        const isCompleted = taskMatch[2].toLowerCase() === "x";
        let taskContent = [line];

        // Handle nested content
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextIndentMatch = nextLine.match(/^\s*/);
          const nextIndent = nextIndentMatch ? nextIndentMatch[0].length : 0;

          if (
            nextIndent <= indent &&
            nextLine.trim().length > 0 &&
            nextLine.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)$/)
          ) {
            break;
          }

          taskContent.push(nextLine);
          i++;
        }
        i--;

        if (!taskGroups.has(indent)) {
          taskGroups.set(indent, { incomplete: [], completed: [] });
        }

        const group = taskGroups.get(indent)!;
        if (isCompleted) {
          group.completed.push(...taskContent);
        } else {
          group.incomplete.push(...taskContent);
        }
      } else {
        result.push(line);
      }
      i++;
    }

    // Combine tasks back together
    for (const [indent, group] of taskGroups) {
      result.push(...group.incomplete);
      result.push(...group.completed);
    }

    return result.join("\n");
  }
}

class TaskOrganizerSettingTab extends PluginSettingTab {
  plugin: TaskOrganizerPlugin;

  constructor(app: App, plugin: TaskOrganizerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Organize on Save")
      .setDesc("Automatically organize tasks when saving the note")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.organizerOnSave)
          .onChange(async (value) => {
            this.plugin.settings.organizerOnSave = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Keep Subtasks with Parent")
      .setDesc("Keep completed subtasks with their parent task")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.keepSubtasksWithParent)
          .onChange(async (value) => {
            this.plugin.settings.keepSubtasksWithParent = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
