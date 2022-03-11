const httpStatus = require('http-status');
const { User, Role, ModelHasRole } = require('@src/models').tenant;
const ApiError = require('@src/utils/ApiError');
const tenantDatabase = require('@src/models').tenant;
const factory = require('@root/tests/utils/factory');
const DeleteFormApprove = require('./DeleteFormApprove');

describe('Stock Correction - Delete Form Approve', () => {
  describe('validations', () => {
    it('throw error when stock correction is not exist', async () => {
      const approver = await factory.user.create();

      await expect(async () => {
        await new DeleteFormApprove(tenantDatabase, { approver, stockCorrectionId: 'invalid-id' }).call();
      }).rejects.toThrow(new ApiError(httpStatus.NOT_FOUND, 'Stock correction is not exist'));
    });

    it('throw error when approved by unwanted user', async () => {
      const hacker = await factory.user.create();
      const { stockCorrection, stockCorrectionForm, approver } = await generateRecordFactories();
      await stockCorrectionForm.update({ cancellationStatus: 0, requestCancellationTo: approver.id });

      await expect(async () => {
        await new DeleteFormApprove(tenantDatabase, { approver: hacker, stockCorrectionId: stockCorrection.id }).call();
      }).rejects.toThrow(new ApiError(httpStatus.FORBIDDEN, 'Forbidden - You are not selected approver'));
    });

    it('throw error when stock correction not requested to be delete', async () => {
      const { stockCorrection, stockCorrectionForm, approver } = await generateRecordFactories();

      expect(stockCorrectionForm.cancellationStatus).toBeUndefined();
      await expect(async () => {
        await new DeleteFormApprove(tenantDatabase, { approver, stockCorrectionId: stockCorrection.id }).call();
      }).rejects.toThrow(new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Stock correction is not requested to be delete'));
    });

    it('throw error when stock correction is already done', async () => {
      const { approver, stockCorrection, stockCorrectionForm } = await generateRecordFactories();
      await stockCorrectionForm.update({
        cancellationStatus: 0,
        requestCancellationTo: approver.id,
        done: true,
      });

      await expect(async () => {
        await new DeleteFormApprove(tenantDatabase, { approver, stockCorrectionId: stockCorrection.id }).call();
      }).rejects.toThrow(
        new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Can not delete already referenced stock correction')
      );
    });
  });

  describe('success', () => {
    let stockCorrection, stockCorrectionForm, approver;
    beforeEach(async (done) => {
      const recordFactories = await generateRecordFactories();
      ({ stockCorrection, stockCorrectionForm, approver } = recordFactories);
      await stockCorrectionForm.update({ cancellationStatus: 0, requestCancellationTo: approver.id });

      done();
    });

    it('change form cancellation status to approved', async () => {
      ({ stockCorrection } = await new DeleteFormApprove(tenantDatabase, {
        approver,
        stockCorrectionId: stockCorrection.id,
      }).call());

      await stockCorrectionForm.reload();
      expect(stockCorrectionForm.cancellationStatus).toEqual(1); // approved
    });

    it('can be approve by super admin', async () => {
      const superAdmin = await factory.user.create();
      const superAdminRole = await Role.create({ name: 'super admin', guardName: 'api' });
      await ModelHasRole.create({
        roleId: superAdminRole.id,
        modelId: superAdmin.id,
        modelType: 'App\\Model\\Master\\User',
      });
      approver = await User.findOne({
        where: { id: superAdmin.id },
        include: [{ model: ModelHasRole, as: 'modelHasRole', include: [{ model: Role, as: 'role' }] }],
      });

      ({ stockCorrection } = await new DeleteFormApprove(tenantDatabase, {
        approver,
        stockCorrectionId: stockCorrection.id,
      }).call());

      await stockCorrectionForm.reload();
      expect(stockCorrectionForm.cancellationStatus).toEqual(1); // approved
    });
  });
});

const generateRecordFactories = async ({
  maker,
  approver,
  branch,
  warehouse,
  item,
  stockCorrection,
  stockCorrectionItem,
  stockCorrectionForm,
} = {}) => {
  const chartOfAccountType = await tenantDatabase.ChartOfAccountType.create({
    name: 'cost of sales',
    alias: 'beban pokok penjualan',
    isDebit: true,
  });
  const chartOfAccount = await tenantDatabase.ChartOfAccount.create({
    typeId: chartOfAccountType.id,
    position: 'DEBIT',
    name: 'beban selisih persediaan',
    alias: 'beban selisih persediaan',
  });

  maker = await factory.user.create(maker);
  approver = await factory.user.create(approver);
  branch = await factory.branch.create(branch);
  warehouse = await factory.warehouse.create({ branch, ...warehouse });
  item = await factory.item.create({ chartOfAccount, ...item });
  stockCorrection = await factory.stockCorrection.create({ warehouse, ...stockCorrection });
  stockCorrectionItem = await factory.stockCorrectionItem.create({
    stockCorrection,
    quantity: 10,
    item,
  });
  stockCorrectionForm = await factory.form.create({
    branch,
    createdBy: maker.id,
    updatedBy: maker.id,
    requestApprovalTo: approver.id,
    formable: stockCorrection,
    formableType: 'StockCorrection',
    number: 'SC2101001',
  });

  await tenantDatabase.SettingJournal.create({
    feature: 'stock correction',
    name: 'difference stock expenses',
    description: 'difference stock expenses',
    chartOfAccountId: chartOfAccount.id,
  });

  return {
    maker,
    approver,
    branch,
    warehouse,
    item,
    stockCorrection,
    stockCorrectionItem,
    stockCorrectionForm,
  };
};
