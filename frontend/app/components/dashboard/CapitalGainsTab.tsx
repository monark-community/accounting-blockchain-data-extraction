import { useMemo, useState } from "react";
import { Calculator, PieChart, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  type CapitalGainEntry,
  type AccountingMethod,
} from "@/utils/capitalGains";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { PieChart as RPieChart, Pie, Cell } from "recharts";

interface CapitalGainsTabProps {
  capitalGainsData: {
    realized: CapitalGainEntry[];
    unrealized: CapitalGainEntry[];
    totalRealizedGains: number;
    totalUnrealizedGains: number;
    shortTermGains: number;
    longTermGains: number;
  };
  accountingMethod: AccountingMethod;
  setAccountingMethod: (method: AccountingMethod) => void;
  currency: string;
  loading: boolean;
}

const CapitalGainsTab = ({
  capitalGainsData,
  accountingMethod,
  setAccountingMethod,
  currency,
  loading,
}: CapitalGainsTabProps) => {
  const [visibleColumns, setVisibleColumns] = useState({
    asset: true,
    quantity: true,
    price: true,
    costBasis: true,
    gain: true,
    gainPercent: true,
    holdingPeriod: true,
    taxTreatment: true,
  });

  const realizedTimeline = useMemo(() => {
    const bucket = new Map<
      string,
      { date: string; shortTerm: number; longTerm: number }
    >();
    capitalGainsData.realized.forEach((entry) => {
      const label = new Date(entry.saleDate).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      if (!bucket.has(label)) {
        bucket.set(label, { date: label, shortTerm: 0, longTerm: 0 });
      }
      const record = bucket.get(label)!;
      if (entry.isLongTerm) record.longTerm += entry.gain;
      else record.shortTerm += entry.gain;
    });
    return Array.from(bucket.values());
  }, [capitalGainsData.realized]);

  const realizedByAsset = useMemo(() => {
    const map = new Map<string, number>();
    capitalGainsData.realized.forEach((entry) => {
      if (!entry.asset) return;
      map.set(entry.asset, (map.get(entry.asset) ?? 0) + entry.gain);
    });
    return Array.from(map.entries())
      .map(([asset, value]) => ({ asset, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 6);
  }, [capitalGainsData.realized]);

  return (
    <div className="space-y-6">
      {/* Capital Gains Summary */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">
                Total Realized Gains
              </p>
              {loading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <CurrencyDisplay
                  amount={capitalGainsData.totalRealizedGains}
                  currency={currency}
                  variant="large"
                  showSign={false}
                  className={
                    capitalGainsData.totalRealizedGains >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                />
              )}
            </div>
            <Calculator className="w-12 h-12 text-green-500" />
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">
                Total Unrealized Gains
              </p>
              {loading ? (
                <Skeleton className="h-8 w-32 mt-2" />
              ) : (
                <CurrencyDisplay
                  amount={capitalGainsData.totalUnrealizedGains}
                  currency={currency}
                  variant="large"
                  showSign={false}
                  className={
                    capitalGainsData.totalUnrealizedGains >= 0
                      ? "text-blue-600"
                      : "text-red-600"
                  }
                />
              )}
            </div>
            <PieChart className="w-12 h-12 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">
                Short-term Gains
              </p>
              {loading ? (
                <Skeleton className="h-6 w-24 mt-2" />
              ) : (
                <CurrencyDisplay
                  amount={capitalGainsData.shortTermGains}
                  currency={currency}
                  variant="default"
                  showSign={false}
                  className={
                    capitalGainsData.shortTermGains >= 0
                      ? "text-orange-600"
                      : "text-red-600"
                  }
                />
              )}
              <p className="text-xs text-slate-500">Taxed as ordinary income</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">
                Long-term Gains
              </p>
              {loading ? (
                <Skeleton className="h-6 w-24 mt-2" />
              ) : (
                <CurrencyDisplay
                  amount={capitalGainsData.longTermGains}
                  currency={currency}
                  variant="default"
                  showSign={false}
                  className={
                    capitalGainsData.longTermGains >= 0
                      ? "text-purple-600"
                      : "text-red-600"
                  }
                />
              )}
              <p className="text-xs text-slate-500">Preferential tax rates</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              Realized Gains Timeline
            </h3>
            <Badge variant="outline">Short vs Long</Badge>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : realizedTimeline.length === 0 ? (
            <p className="text-sm text-slate-500">
              No realized gains available.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={realizedTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000
                      ? `$${(v / 1000).toFixed(0)}k`
                      : `$${v.toFixed(0)}`
                  }
                  tick={{ fontSize: 12 }}
                  width={60}
                />
                <RechartsTooltip
                  formatter={(value: number) => [
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency,
                    }).format(value as number),
                    "Gain",
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="shortTerm"
                  stackId="gain"
                  fill="#f97316"
                  name="Short Term"
                />
                <Bar
                  dataKey="longTerm"
                  stackId="gain"
                  fill="#8b5cf6"
                  name="Long Term"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              Top Realized Contributors
            </h3>
            <Badge variant="outline">Top 6</Badge>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : realizedByAsset.length === 0 ? (
            <p className="text-sm text-slate-500">
              No realized gains to display.
            </p>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <ResponsiveContainer width="100%" height={220}>
                <RPieChart>
                  <Pie
                    data={realizedByAsset}
                    dataKey="value"
                    nameKey="asset"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(entry) => {
                      const totalAbs = realizedByAsset.reduce((sum, e) => sum + Math.abs(e.value), 0);
                      const pct = totalAbs > 0 ? (Math.abs(entry.value) / totalAbs) * 100 : 0;
                      if (pct < 8) return null;
                      return `${entry.asset.slice(0, 6)}${entry.asset.length > 6 ? '...' : ''}`;
                    }}
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {realizedByAsset.map((entry, idx) => {
                      const colors = [
                        "#3b82f6",
                        "#10b981",
                        "#f97316",
                        "#a855f7",
                        "#14b8a6",
                        "#ef4444",
                      ];
                      return (
                        <Cell
                          key={entry.asset}
                          fill={colors[idx % colors.length]}
                        />
                      );
                    })}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload;
                      
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                          <p className="font-semibold text-sm">{data.asset}</p>
                          <p className="text-xs text-slate-600">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency,
                            }).format(data.value)}
                          </p>
                          <p className={`text-xs ${data.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {data.value >= 0 ? "Gain" : "Loss"}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </RPieChart>
              </ResponsiveContainer>
              <ul className="flex-1 text-sm space-y-1">
                {realizedByAsset.map((entry) => (
                  <li
                    key={entry.asset}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-700">
                      {entry.asset}
                    </span>
                    <span
                      className={
                        entry.value >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      <CurrencyDisplay
                        amount={entry.value}
                        currency={currency}
                        showSign={false}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Accounting Method Selector */}
      <Card className="p-6 bg-white shadow-sm">
        <div className="max-w-md">
          <Label htmlFor="accounting-method" className="text-sm font-medium">
            Accounting Method
          </Label>
          <Select
            value={accountingMethod}
            onValueChange={(value: AccountingMethod) =>
              setAccountingMethod(value)
            }
          >
            <SelectTrigger className="w-full mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIFO">FIFO (First In, First Out)</SelectItem>
              <SelectItem value="LIFO">LIFO (Last In, First Out)</SelectItem>
              <SelectItem value="SPECIFIC_ID">
                Specific Identification
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-1">
            Different methods can significantly impact your tax liability.
            Consult with a tax professional.
          </p>
        </div>
      </Card>

      {/* Capital Gains Tables */}
      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              Capital Gains & Losses
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {Object.entries(visibleColumns).map(([key, visible]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visible}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [key]: !!checked,
                      }))
                    }
                  >
                    {key.charAt(0).toUpperCase() +
                      key.slice(1).replace(/([A-Z])/g, " $1")}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs defaultValue="realized" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mx-6 mt-4">
            <TabsTrigger value="realized">Realized Gains/Losses</TabsTrigger>
            <TabsTrigger value="unrealized">
              Unrealized Gains/Losses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realized" className="space-y-4 p-6">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.asset && <TableHead>Asset</TableHead>}
                      {visibleColumns.quantity && (
                        <TableHead>Quantity</TableHead>
                      )}
                      {visibleColumns.price && (
                        <TableHead>Sale Price</TableHead>
                      )}
                      {visibleColumns.costBasis && (
                        <TableHead>Cost Basis</TableHead>
                      )}
                      {visibleColumns.gain && <TableHead>Gain/Loss</TableHead>}
                      {visibleColumns.gainPercent && (
                        <TableHead>Gain %</TableHead>
                      )}
                      {visibleColumns.holdingPeriod && (
                        <TableHead>Holding Period</TableHead>
                      )}
                      {visibleColumns.taxTreatment && (
                        <TableHead>Tax Treatment</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capitalGainsData.realized.map((gain) => (
                      <TableRow key={gain.id}>
                        {visibleColumns.asset && (
                          <TableCell className="font-medium">
                            {gain.asset}
                          </TableCell>
                        )}
                        {visibleColumns.quantity && (
                          <TableCell>{gain.quantity}</TableCell>
                        )}
                        {visibleColumns.price && (
                          <TableCell>
                            <CurrencyDisplay
                              amount={gain.salePrice}
                              currency={currency}
                              showSign={false}
                            />
                          </TableCell>
                        )}
                        {visibleColumns.costBasis && (
                          <TableCell>
                            <CurrencyDisplay
                              amount={gain.costBasis}
                              currency={currency}
                              showSign={false}
                            />
                          </TableCell>
                        )}
                        {visibleColumns.gain && (
                          <TableCell>
                            <CurrencyDisplay
                              amount={gain.gain}
                              currency={currency}
                              className={
                                gain.gain >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            />
                          </TableCell>
                        )}
                        {visibleColumns.gainPercent && (
                          <TableCell
                            className={
                              gain.gainPercent >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {gain.gainPercent.toFixed(2)}%
                          </TableCell>
                        )}
                        {visibleColumns.holdingPeriod && (
                          <TableCell>{gain.holdingPeriod} days</TableCell>
                        )}
                        {visibleColumns.taxTreatment && (
                          <TableCell>
                            <Badge
                              variant={
                                gain.isLongTerm ? "default" : "secondary"
                              }
                            >
                              {gain.isLongTerm ? "Long-term" : "Short-term"}
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {capitalGainsData.realized.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={
                            Object.values(visibleColumns).filter(Boolean).length
                          }
                          className="text-center py-8 text-slate-500"
                        >
                          No realized gains/losses found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="unrealized" className="space-y-4 p-6">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.asset && <TableHead>Asset</TableHead>}
                      {visibleColumns.quantity && (
                        <TableHead>Quantity</TableHead>
                      )}
                      {visibleColumns.price && (
                        <TableHead>Current Price</TableHead>
                      )}
                      {visibleColumns.costBasis && (
                        <TableHead>Cost Basis</TableHead>
                      )}
                      {visibleColumns.gain && (
                        <TableHead>Unrealized Gain/Loss</TableHead>
                      )}
                      {visibleColumns.gainPercent && (
                        <TableHead>Gain %</TableHead>
                      )}
                      {visibleColumns.holdingPeriod && (
                        <TableHead>Holding Period</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capitalGainsData.unrealized.map((gain) => (
                      <TableRow key={gain.id}>
                        {visibleColumns.asset && (
                          <TableCell className="font-medium">
                            {gain.asset}
                          </TableCell>
                        )}
                        {visibleColumns.quantity && (
                          <TableCell>{gain.quantity}</TableCell>
                        )}
                        {visibleColumns.price && (
                          <TableCell>
                            <CurrencyDisplay
                              amount={gain.salePrice}
                              currency={currency}
                              showSign={false}
                            />
                          </TableCell>
                        )}
                        {visibleColumns.costBasis && (
                          <TableCell>
                            <CurrencyDisplay
                              amount={gain.costBasis}
                              currency={currency}
                              showSign={false}
                            />
                          </TableCell>
                        )}
                        {visibleColumns.gain && (
                          <TableCell>
                            <CurrencyDisplay
                              amount={gain.gain}
                              currency={currency}
                              className={
                                gain.gain >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            />
                          </TableCell>
                        )}
                        {visibleColumns.gainPercent && (
                          <TableCell
                            className={
                              gain.gainPercent >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {gain.gainPercent.toFixed(2)}%
                          </TableCell>
                        )}
                        {visibleColumns.holdingPeriod && (
                          <TableCell>{gain.holdingPeriod} days</TableCell>
                        )}
                      </TableRow>
                    ))}
                    {capitalGainsData.unrealized.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={
                            Object.values(visibleColumns).filter(Boolean).length
                          }
                          className="text-center py-8 text-slate-500"
                        >
                          No unrealized gains/losses found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default CapitalGainsTab;
