import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackend } from "@/lib/useBackend";
import { RefreshCw, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { IntentRule } from "~backend/intent_scorer/types";

export default function RulesTab() {
  const { toast } = useToast();
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState<number>(0);
  const [editDescription, setEditDescription] = useState<string>("");
  const backend = useBackend();

  const { data, loading, error, execute } = useBackend(
    async (backend) => {
      return await backend.intent_scorer.listRules();
    },
    []
  );

  const rules = data?.rules || [];

  const handleEdit = (rule: IntentRule) => {
    setEditingRule(rule.rule_key);
    setEditPoints(rule.points);
    setEditDescription(rule.description || "");
  };

  const handleSave = async (ruleKey: string) => {
    try {
      await backend.intent_scorer.updateRule({
        rule_key: ruleKey,
        points: editPoints,
        description: editDescription,
      });
      toast({
        title: "Success",
        description: "Rule updated successfully",
      });
      setEditingRule(null);
      execute();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update rule",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (ruleKey: string, currentState: boolean) => {
    try {
      await backend.intent_scorer.updateRule({
        rule_key: ruleKey,
        is_active: !currentState,
      });
      toast({
        title: "Success",
        description: `Rule ${!currentState ? "enabled" : "disabled"}`,
      });
      execute();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to toggle rule",
        variant: "destructive",
      });
    }
  };

  const baseScoreRules = rules.filter((r) => r.rule_type === "base_score");
  const modifierRules = rules.filter((r) => r.rule_type === "modifier");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Scoring Rules Configuration</CardTitle>
            <CardDescription>Edit base scores and modifiers</CardDescription>
          </div>
          <Button onClick={execute} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading rules...</p>
          </CardContent>
        </Card>
      )}

      {!loading && rules && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Base Scores by Event Type</CardTitle>
              <CardDescription>Configure points awarded for each event type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {baseScoreRules.map((rule) => (
                  <div key={rule.rule_key} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{rule.event_type}</p>
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    </div>

                    {editingRule === rule.rule_key ? (
                      <>
                        <Input
                          type="number"
                          value={editPoints}
                          onChange={(e) => setEditPoints(parseInt(e.target.value, 10))}
                          className="w-24"
                        />
                        <Button onClick={() => handleSave(rule.rule_key)} size="sm">
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={() => setEditingRule(null)} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{rule.points}</p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                        <Button onClick={() => handleEdit(rule)} variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleToggle(rule.rule_key, rule.is_active)}
                          variant={rule.is_active ? "outline" : "secondary"}
                          size="sm"
                        >
                          {rule.is_active ? "Enabled" : "Disabled"}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modifiers</CardTitle>
              <CardDescription>Additional points based on event metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {modifierRules.map((rule) => (
                  <div key={rule.rule_key} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{rule.description}</p>
                      {rule.modifier_condition && (
                        <pre className="text-xs text-muted-foreground mt-1">
                          {JSON.stringify(rule.modifier_condition)}
                        </pre>
                      )}
                    </div>

                    {editingRule === rule.rule_key ? (
                      <>
                        <Input
                          type="number"
                          value={editPoints}
                          onChange={(e) => setEditPoints(parseInt(e.target.value, 10))}
                          className="w-24"
                        />
                        <Button onClick={() => handleSave(rule.rule_key)} size="sm">
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={() => setEditingRule(null)} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{rule.points}</p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                        <Button onClick={() => handleEdit(rule)} variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleToggle(rule.rule_key, rule.is_active)}
                          variant={rule.is_active ? "outline" : "secondary"}
                          size="sm"
                        >
                          {rule.is_active ? "Enabled" : "Disabled"}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
