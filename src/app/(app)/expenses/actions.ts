"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getActionErrorMessage } from "@/lib/errors";
import { assertJournalBalanced } from "@/modules/accounting/domain/journal";

const expenseSchema = z.object({
  vendorName: z.string().trim().min(2, "Vendor name is required."),
  expenseCategoryId: z.string().min(1, "Category is required."),
  description: z.string().trim().min(2, "Description is required."),
  amount: z.coerce.number().gt(0, "Amount must be greater than zero."),
  issueDate: z.string().min(1, "Issue date is required."),
  notes: z.string().trim().max(2000).optional(),
});

export async function createExpenseAction(formData: FormData) {
  const user = await requireUser("expenses:view");
  let redirectUrl: Parameters<typeof redirect>[0] = "/expenses?created=1";

  try {
    const payload = expenseSchema.parse({
      vendorName: String(formData.get("vendorName") ?? ""),
      expenseCategoryId: String(formData.get("expenseCategoryId") ?? ""),
      description: String(formData.get("description") ?? ""),
      amount: formData.get("amount"),
      issueDate: String(formData.get("issueDate") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });

    const issueDate = new Date(payload.issueDate);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const [category, apAccount] = await Promise.all([
      db.expenseCategory.findUniqueOrThrow({
        where: { id: payload.expenseCategoryId },
        include: { defaultAccount: true },
      }),
      db.ledgerAccount.findUniqueOrThrow({ where: { code: "2100" } }),
    ]);

    const expenseAccount = category.defaultAccount;

    await db.$transaction(async (trx) => {
      const billCount = await trx.vendorBill.count();
      const billNumber = `BILL-${String(billCount + 1).padStart(4, "0")}`;

      let vendor = await trx.vendor.findFirst({
        where: { name: { equals: payload.vendorName, mode: "insensitive" } },
      });

      if (!vendor) {
        const vendorCount = await trx.vendor.count();
        vendor = await trx.vendor.create({
          data: {
            code: `VEND-${String(vendorCount + 1).padStart(4, "0")}`,
            name: payload.vendorName,
            type: "SUPPLIER",
          },
        });
      }

      const bill = await trx.vendorBill.create({
        data: {
          billNumber,
          vendorId: vendor.id,
          expenseCategoryId: category.id,
          issueDate,
          dueDate,
          status: "POSTED",
          subtotal: payload.amount,
          vatTotal: 0,
          total: payload.amount,
          notes: payload.notes || null,
          createdById: user.id,
          lines: {
            create: {
              description: payload.description,
              quantity: 1,
              unitCost: payload.amount,
              lineTotal: payload.amount,
              accountId: expenseAccount.id,
            },
          },
        },
      });

      const journalLines = [
        { accountId: expenseAccount.id, debit: payload.amount, credit: 0 },
        { accountId: apAccount.id, debit: 0, credit: payload.amount },
      ];

      assertJournalBalanced(
        journalLines.map((l) => ({
          accountId: l.accountId,
          code: l.accountId,
          name: l.accountId,
          type: "ASSET" as const,
          debit: l.debit,
          credit: l.credit,
        })),
      );

      const jeCount = await trx.journalEntry.count();
      await trx.journalEntry.create({
        data: {
          entryNumber: `JE-EXP-${String(jeCount + 1).padStart(4, "0")}`,
          entryDate: issueDate,
          status: "POSTED",
          sourceType: "VENDOR_BILL",
          sourceId: bill.id,
          memo: `${category.name}: ${payload.description}`,
          createdById: user.id,
          postedAt: issueDate,
          lines: { create: journalLines },
        },
      });

      await trx.auditLog.create({
        data: {
          actorId: user.id,
          entityType: "vendor_bill",
          entityId: bill.id,
          action: "expense.created",
          after: { billNumber, vendor: payload.vendorName, amount: payload.amount, category: category.name },
        },
      });
    });
  } catch (error) {
    redirectUrl = `/expenses?error=${encodeURIComponent(getActionErrorMessage(error, "Unable to record expense."))}`;
  }

  redirect(redirectUrl);
}
