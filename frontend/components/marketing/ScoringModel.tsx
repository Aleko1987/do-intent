import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useBackend } from "@/lib/useBackend";
import { useAuth } from "@clerk/clerk-react";
import type { IntentRule } from "~backend/intent_scorer/types";

interface LeadScoringConfig {
  m1_min: number;
  m2_min: number;
  m3_min: number;
  m4_min: number;
  m5_min: number;
  auto_push_threshold: number;
  decay_points_per_week: number;
}

const DEFAULT_SCORING_CONFIG: LeadScoringConfig = {
  m1_min: 0,
  m2_min: 6,
  m3_min: 16,
  m4_min: 31,
  m5_min: 46,
  auto_push_threshold: 31,
  decay_points_per_week: 1,
};

export default function ScoringModel() {
  const { toast } = useToast();
  const backend = useBackend();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<string>("0");
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [draftActive, setDraftActive] = useState<boolean>(true);
  const [savingRuleKey, setSavingRuleKey] = useState<string | null>(null);
  const [config, setConfig] = useState<LeadScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [draftConfig, setDraftConfig] = useState<LeadScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

  const { data, loading, error, execute } = useBackend(
    async (backend) => {
      return await backend.intent_scorer.listRules();
    },
    []
  );

  const rules = data?.rules ?? [];
  const baseRules = useMemo(
    () => rules.filter((rule) => rule.rule_type === "base_score"),
    [rules]
  );
  const modifierRules = useMemo(
    () => rules.filter((rule) => rule.rule_type === "modifier"),
    [rules]
  );

  const loadConfig = async () => {
    if (!isLoaded || !isSignedIn) {
      setConfigLoading(false);
      return;
    }

    setConfigLoading(true);
    try {
      const token = await getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/marketing/scoring-config", {
        method: "GET",
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as LeadScoringConfig;
      setConfig(payload);
      setDraftConfig(payload);
    } catch (fetchError) {
      console.error("Failed to load scoring config:", fetchError);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load qualification settings",
      });
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, [isLoaded, isSignedIn]);

  const beginEditingRule = (rule: IntentRule) => {
    setEditingRuleKey(rule.rule_key);
    setDraftPoints(String(rule.points));
    setDraftDescription(rule.description ?? "");
    setDraftActive(rule.is_active);
  };

  const cancelEditingRule = () => {
    setEditingRuleKey(null);
    setDraftPoints("0");
    setDraftDescription("");
    setDraftActive(true);
  };

  const saveRule = async (ruleKey: string) => {
    const parsedPoints = Number(draftPoints);
    if (!Number.isFinite(parsedPoints) || parsedPoints < 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Points must be a non-negative number",
      });
      return;
    }

    setSavingRuleKey(ruleKey);
    try {
      await backend.intent_scorer.updateRule({
        rule_key: ruleKey,
        points: parsedPoints,
        description: draftDescription,
        is_active: draftActive,
      });
      toast({
        title: "Rule saved",
        description: `Updated ${ruleKey}`,
      });
      cancelEditingRule();
      execute();
    } catch (saveError) {
      console.error("Failed to save rule:", saveError);
      toast({
        variant: "destructive",
        title: "Error",
        description: saveError instanceof Error ? saveError.message : "Failed to update rule",
      });
    } finally {
      setSavingRuleKey(null);
    }
  };

  const validateDraftConfig = (candidate: LeadScoringConfig): string | null => {
    const values = Object.values(candidate);
    if (values.some((value) => !Number.isInteger(value) || value < 0)) {
      return "All values must be non-negative integers";
    }
    if (
      candidate.m1_min > candidate.m2_min ||
      candidate.m2_min > candidate.m3_min ||
      candidate.m3_min > candidate.m4_min ||
      candidate.m4_min > candidate.m5_min
    ) {
      return "Stage minimums must be ascending (M1 <= M2 <= M3 <= M4 <= M5)";
    }
    return null;
  };

  const updateConfigValue = (field: keyof LeadScoringConfig, rawValue: string) => {
    const parsed = Number(rawValue);
    setDraftConfig((prev) => ({
      ...prev,
      [field]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  };

  const saveConfig = async () => {
    const validationError = validateDraftConfig(draftConfig);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Invalid settings",
        description: validationError,
      });
      return;
    }

    setConfigSaving(true);
    try {
      const token = await getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/marketing/scoring-config", {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify(draftConfig),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as LeadScoringConfig;
      setConfig(payload);
      setDraftConfig(payload);
      toast({
        title: "Settings saved",
        description: "Qualification settings have been updated",
      });
    } catch (saveError) {
      console.error("Failed to save scoring config:", saveError);
      toast({
        variant: "destructive",
        title: "Error",
        description: saveError instanceof Error ? saveError.message : "Failed to save settings",
      });
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-2">Scoring Model</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Review and tune how intent signals qualify an audience into leads.
        </p>
        <p className="text-xs text-muted-foreground">
          Changes here affect how stage qualification and intent score accumulation are calculated.
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Qualification Settings</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraftConfig(config)}
              disabled={configSaving || configLoading}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveConfig}
              disabled={configSaving || configLoading}
            >
              {configSaving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </div>

        {configLoading ? (
          <p className="text-sm text-muted-foreground">Loading qualification settings...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">M1 minimum</p>
              <Input
                type="number"
                value={draftConfig.m1_min}
                onChange={(e) => updateConfigValue("m1_min", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">M2 minimum</p>
              <Input
                type="number"
                value={draftConfig.m2_min}
                onChange={(e) => updateConfigValue("m2_min", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">M3 minimum</p>
              <Input
                type="number"
                value={draftConfig.m3_min}
                onChange={(e) => updateConfigValue("m3_min", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">M4 minimum</p>
              <Input
                type="number"
                value={draftConfig.m4_min}
                onChange={(e) => updateConfigValue("m4_min", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">M5 minimum</p>
              <Input
                type="number"
                value={draftConfig.m5_min}
                onChange={(e) => updateConfigValue("m5_min", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Auto-push threshold</p>
              <Input
                type="number"
                value={draftConfig.auto_push_threshold}
                onChange={(e) => updateConfigValue("auto_push_threshold", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Decay points per week</p>
              <Input
                type="number"
                value={draftConfig.decay_points_per_week}
                onChange={(e) => updateConfigValue("decay_points_per_week", e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {loading && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Loading scoring rules...</p>
        </Card>
      )}

      {error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {!loading && !error && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Base Rules</h3>
            <div className="space-y-2">
              {baseRules.map((rule) => (
                <div key={rule.rule_key} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{rule.event_type || rule.rule_key}</p>
                      <p className="text-xs text-muted-foreground">{rule.rule_key}</p>
                    </div>
                    <Badge variant={rule.is_active ? "secondary" : "outline"}>
                      {rule.is_active ? "active" : "inactive"}
                    </Badge>
                  </div>

                  {editingRuleKey === rule.rule_key ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input
                          type="number"
                          value={draftPoints}
                          onChange={(e) => setDraftPoints(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant={draftActive ? "secondary" : "outline"}
                          onClick={() => setDraftActive((prev) => !prev)}
                        >
                          {draftActive ? "Active" : "Inactive"}
                        </Button>
                      </div>
                      <Textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder="Rule description"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveRule(rule.rule_key)}
                          disabled={savingRuleKey === rule.rule_key}
                        >
                          {savingRuleKey === rule.rule_key ? "Saving..." : "Save"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={cancelEditingRule}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{rule.points} pts</Badge>
                      <Button type="button" variant="outline" size="sm" onClick={() => beginEditingRule(rule)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Modifiers</h3>
            <div className="space-y-2">
              {modifierRules.map((rule) => (
                <div key={rule.rule_key} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{rule.rule_key}</p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                    <Badge variant={rule.is_active ? "secondary" : "outline"}>
                      {rule.is_active ? "active" : "inactive"}
                    </Badge>
                  </div>

                  {editingRuleKey === rule.rule_key ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input
                          type="number"
                          value={draftPoints}
                          onChange={(e) => setDraftPoints(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant={draftActive ? "secondary" : "outline"}
                          onClick={() => setDraftActive((prev) => !prev)}
                        >
                          {draftActive ? "Active" : "Inactive"}
                        </Button>
                      </div>
                      <Textarea
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        placeholder="Rule description"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveRule(rule.rule_key)}
                          disabled={savingRuleKey === rule.rule_key}
                        >
                          {savingRuleKey === rule.rule_key ? "Saving..." : "Save"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={cancelEditingRule}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{rule.points} pts</Badge>
                      <Button type="button" variant="outline" size="sm" onClick={() => beginEditingRule(rule)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
