class FindOne {
  constructor(tenantDatabase, salesInvoiceId) {
    this.tenantDatabase = tenantDatabase;
    this.salesInvoiceId = salesInvoiceId;
  }

  async call() {
    const salesInvoice = await this.tenantDatabase.SalesInvoice.findOne({
      where: {
        id: this.salesInvoiceId,
      },
      include: [
        {
          model: this.tenantDatabase.SalesInvoiceItem,
          as: 'items',
          include: [{ model: this.tenantDatabase.Allocation, as: 'allocation' }],
        },
        {
          model: this.tenantDatabase.Form,
          as: 'form',
          include: [
            { model: this.tenantDatabase.User, as: 'requestApprovalToUser' },
            { model: this.tenantDatabase.User, as: 'createdByUser' },
          ],
        },
        { model: this.tenantDatabase.Customer, as: 'customer' },
      ],
    });
    const referenceable = await salesInvoice.getReferenceable({
      include: [{ model: this.tenantDatabase.Form, as: 'form' }],
    });
    salesInvoice.dataValues.referenceable = referenceable;

    return { salesInvoice };
  }
}

module.exports = FindOne;
