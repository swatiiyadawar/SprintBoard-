const express = require('express')
const { summarizeDeliveryRisks } = require('../deliveryRisk')
const { validateTimeZone } = require('../validation')

function createDashboardRouter(deliveryRisks) {
  const router = express.Router()

  router.get('/delivery-risks', async (_req, res, next) => {
    try {
      const data = await deliveryRisks.getSummary(validateTimeZone(_req.query.timeZone))
      res.json({ data: summarizeDeliveryRisks(data) })
    } catch (error) {
      next(error)
    }
  })

  return router
}

module.exports = { createDashboardRouter }
