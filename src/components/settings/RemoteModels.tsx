import React, { useState } from "react";
import { commands } from "../../bindings";
import { SettingContainer } from "../ui/SettingContainer";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useModels } from "../../hooks/useModels";
import type { ModelInfo } from "../../bindings";

interface RemoteModelFormData {
  id: string;
  name: string;
  description: string;
  api_url: string;
  api_key: string;
  model_name: string;
}

export const RemoteModels: React.FC<{
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}> = ({ descriptionMode = "inline", grouped = false }) => {
  const { models, refreshModels } = useModels();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<RemoteModelFormData>({
    id: "",
    name: "",
    description: "",
    api_url: "",
    api_key: "",
    model_name: "whisper-1",
  });
  const [error, setError] = useState<string>("");

  const remoteModels = models.filter(
    (m: ModelInfo) => m.engine_type === "RemoteWhisper",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const result = await commands.addRemoteModel(
        formData.id,
        formData.name,
        formData.description,
        formData.api_url,
        formData.api_key || null,
        formData.model_name,
      );

      if (result.status === "error") {
        setError(result.error);
        return;
      }

      // Reset form
      setFormData({
        id: "",
        name: "",
        description: "",
        api_url: "",
        api_key: "",
        model_name: "whisper-1",
      });
      setIsAdding(false);
      await refreshModels();
    } catch (err) {
      setError(err as string);
    }
  };

  const handleRemove = async (modelId: string) => {
    try {
      const result = await commands.removeRemoteModel(modelId);
      if (result.status === "error") {
        console.error("Failed to remove remote model:", result.error);
        return;
      }
      await refreshModels();
    } catch (err) {
      console.error("Failed to remove remote model:", err);
    }
  };

  return (
    <SettingContainer
      title="Remote Models"
      description="Configure remote OpenAI-compatible API endpoints for transcription"
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <div className="space-y-4">
        {remoteModels.length > 0 && (
          <div className="space-y-2">
            {remoteModels.map((model: ModelInfo) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded"
              >
                <div>
                  <div className="font-medium">{model.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {model.description}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(model.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Add Remote Model
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded"
          >
            <Input
              label="Model ID"
              placeholder="e.g., my-openai-api"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              required
            />
            <Input
              label="Display Name"
              placeholder="e.g., OpenAI Whisper"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <Input
              label="Description"
              placeholder="e.g., OpenAI API transcription"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
            <Input
              label="API URL"
              placeholder="https://api.openai.com/v1"
              value={formData.api_url}
              onChange={(e) =>
                setFormData({ ...formData, api_url: e.target.value })
              }
              required
            />
            <Input
              label="API Key"
              type="password"
              placeholder="sk-..."
              value={formData.api_key}
              onChange={(e) =>
                setFormData({ ...formData, api_key: e.target.value })
              }
            />
            <Input
              label="Model Name"
              placeholder="whisper-1"
              value={formData.model_name}
              onChange={(e) =>
                setFormData({ ...formData, model_name: e.target.value })
              }
              required
            />

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setError("");
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </SettingContainer>
  );
};
