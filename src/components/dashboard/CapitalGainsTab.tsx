
import { useState } from "react";
import { Calculator, PieChart, Filter, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { type CapitalGainEntry, type AccountingMethod } from "@/utils/capitalGains";

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
}

const CapitalGainsTab = ({ capitalGainsData, accountingMethod, setAccountingMethod }: CapitalGainsTabProps) => {
  const [visibleColumns, setVisibleColumns] = useState({
    asset: true,
    quantity: true,
    price: true,
    costBasis: true,
    gain: true,
    gainPercent: true,
    holdingPeriod: true,
    taxTreatment: true
  });

  return (
    <div className="space-y-6">
      {/* Capital Gains Summary */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Total Realized Gains</p>
              <p className={`text-3xl font-bold ${capitalGainsData.totalRealizedGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${capitalGainsData.totalRealizedGains.toFixed(2)}
              </p>
            </div>
            <Calculator className="w-12 h-12 text-green-500" />
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Total Unrealized Gains</p>
              <p className={`text-3xl font-bold ${capitalGainsData.totalUnrealizedGains >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                ${capitalGainsData.totalUnrealizedGains.toFixed(2)}
              </p>
            </div>
            <PieChart className="w-12 h-12 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Short-term Gains</p>
              <p className={`text-2xl font-bold ${capitalGainsData.shortTermGains >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                ${capitalGainsData.shortTermGains.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">Taxed as ordinary income</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Long-term Gains</p>
              <p className={`text-2xl font-bold ${capitalGainsData.longTermGains >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                ${capitalGainsData.longTermGains.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">Preferential tax rates</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Accounting Method Selector */}
      <Card className="p-6 bg-white shadow-sm">
        <div className="max-w-md">
          <Label htmlFor="accounting-method" className="text-sm font-medium">Accounting Method</Label>
          <Select value={accountingMethod} onValueChange={(value: AccountingMethod) => setAccountingMethod(value)}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIFO">FIFO (First In, First Out)</SelectItem>
              <SelectItem value="LIFO">LIFO (Last In, First Out)</SelectItem>
              <SelectItem value="SPECIFIC_ID">Specific Identification</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-1">
            Different methods can significantly impact your tax liability. Consult with a tax professional.
          </p>
        </div>
      </Card>

      {/* Capital Gains Tables */}
      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">Capital Gains & Losses</h3>
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
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [key]: !!checked }))}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs defaultValue="realized" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mx-6 mt-4">
            <TabsTrigger value="realized">Realized Gains/Losses</TabsTrigger>
            <TabsTrigger value="unrealized">Unrealized Gains/Losses</TabsTrigger>
          </TabsList>
          
          <TabsContent value="realized" className="space-y-4 p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.asset && <TableHead>Asset</TableHead>}
                    {visibleColumns.quantity && <TableHead>Quantity</TableHead>}
                    {visibleColumns.price && <TableHead>Sale Price</TableHead>}
                    {visibleColumns.costBasis && <TableHead>Cost Basis</TableHead>}
                    {visibleColumns.gain && <TableHead>Gain/Loss</TableHead>}
                    {visibleColumns.gainPercent && <TableHead>Gain %</TableHead>}
                    {visibleColumns.holdingPeriod && <TableHead>Holding Period</TableHead>}
                    {visibleColumns.taxTreatment && <TableHead>Tax Treatment</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capitalGainsData.realized.map((gain) => (
                    <TableRow key={gain.id}>
                      {visibleColumns.asset && <TableCell className="font-medium">{gain.asset}</TableCell>}
                      {visibleColumns.quantity && <TableCell>{gain.quantity}</TableCell>}
                      {visibleColumns.price && <TableCell>${gain.salePrice.toFixed(2)}</TableCell>}
                      {visibleColumns.costBasis && <TableCell>${gain.costBasis.toFixed(2)}</TableCell>}
                      {visibleColumns.gain && (
                        <TableCell className={gain.gain >= 0 ? "text-green-600" : "text-red-600"}>
                          ${gain.gain.toFixed(2)}
                        </TableCell>
                      )}
                      {visibleColumns.gainPercent && (
                        <TableCell className={gain.gainPercent >= 0 ? "text-green-600" : "text-red-600"}>
                          {gain.gainPercent.toFixed(2)}%
                        </TableCell>
                      )}
                      {visibleColumns.holdingPeriod && <TableCell>{gain.holdingPeriod} days</TableCell>}
                      {visibleColumns.taxTreatment && (
                        <TableCell>
                          <Badge variant={gain.isLongTerm ? "default" : "secondary"}>
                            {gain.isLongTerm ? "Long-term" : "Short-term"}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {capitalGainsData.realized.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8 text-slate-500">
                        No realized gains/losses found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="unrealized" className="space-y-4 p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.asset && <TableHead>Asset</TableHead>}
                    {visibleColumns.quantity && <TableHead>Quantity</TableHead>}
                    {visibleColumns.price && <TableHead>Current Price</TableHead>}
                    {visibleColumns.costBasis && <TableHead>Cost Basis</TableHead>}
                    {visibleColumns.gain && <TableHead>Unrealized Gain/Loss</TableHead>}
                    {visibleColumns.gainPercent && <TableHead>Gain %</TableHead>}
                    {visibleColumns.holdingPeriod && <TableHead>Holding Period</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capitalGainsData.unrealized.map((gain) => (
                    <TableRow key={gain.id}>
                      {visibleColumns.asset && <TableCell className="font-medium">{gain.asset}</TableCell>}
                      {visibleColumns.quantity && <TableCell>{gain.quantity}</TableCell>}
                      {visibleColumns.price && <TableCell>${gain.salePrice.toFixed(2)}</TableCell>}
                      {visibleColumns.costBasis && <TableCell>${gain.costBasis.toFixed(2)}</TableCell>}
                      {visibleColumns.gain && (
                        <TableCell className={gain.gain >= 0 ? "text-green-600" : "text-red-600"}>
                          ${gain.gain.toFixed(2)}
                        </TableCell>
                      )}
                      {visibleColumns.gainPercent && (
                        <TableCell className={gain.gainPercent >= 0 ? "text-green-600" : "text-red-600"}>
                          {gain.gainPercent.toFixed(2)}%
                        </TableCell>
                      )}
                      {visibleColumns.holdingPeriod && <TableCell>{gain.holdingPeriod} days</TableCell>}
                    </TableRow>
                  ))}
                  {capitalGainsData.unrealized.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8 text-slate-500">
                        No unrealized gains/losses found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default CapitalGainsTab;
