import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CurriculumGap {
  id: string;
  title: string;
  missingFields: string[];
}

interface IncompleteCurriculaAlertProps {
  gaps: CurriculumGap[];
}

const fieldLabels: Record<string, string> = {
  trainer: "المدرب",
  location: "المكان",
  hours: "الساعات",
  objectives: "الأهداف",
  target_groups: "الفئة المستهدفة",
  prepared_by: "المعد",
  executing_entity: "الجهة المنفذة",
};

export default function IncompleteCurriculaAlert({ gaps }: IncompleteCurriculaAlertProps) {
  const navigate = useNavigate();

  if (gaps.length === 0) return null;

  return (
    <Card className="shadow-card border-0 border-r-4 border-r-warning">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          تنبيهات نقص بيانات المناهج
          <Badge className="bg-warning/10 text-warning mr-auto">{gaps.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {gaps.map((g) => (
            <div key={g.id} className="flex items-start justify-between gap-2 p-2 bg-muted rounded-lg text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{g.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {g.missingFields.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs text-warning border-warning/30">
                      {fieldLabels[f] ?? f}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => navigate("/curricula")}>
                إكمال
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
