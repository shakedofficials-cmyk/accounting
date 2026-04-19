import { db } from "@/lib/db";

export async function getExpenseOverview() {
  const [vendorBills, categories] = await Promise.all([
    db.vendorBill.findMany({
      include: {
        vendor: true,
        expenseCategory: true,
        payments: true,
      },
      orderBy: [{ issueDate: "desc" }],
    }),
    db.expenseCategory.findMany({
      include: {
        defaultAccount: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    vendorBills,
    categories,
  };
}
