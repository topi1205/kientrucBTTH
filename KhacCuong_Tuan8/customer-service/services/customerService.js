const Customer = require("../models/customerModel");

const createCustomer = async (data) => {
  const customer = new Customer(data);
  await customer.save();
  return customer;
};

const getCustomerById = async (id) => {
  return await Customer.findById(id);
};

const updateCustomer = async (id, data) => {
  return await Customer.findByIdAndUpdate(id, data, { new: true });
};

const deleteCustomer = async (id) => {
  return await Customer.findByIdAndDelete(id);
};

module.exports = {
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
