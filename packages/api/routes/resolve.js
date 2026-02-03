/**
 * ENS Resolution Routes
 * 
 * Endpoints:
 * GET /api/v1/resolve/:name - Resolve ENS name to address
 * GET /api/v1/reverse/:address - Reverse lookup address to ENS
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const { ethers } = require('ethers');
const { cacheMiddleware } = require('../middleware/cache');

// Ethereum provider for ENS resolution
const PROVIDER_URL = process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Cache TTL
const ENS_CACHE_TTL = 300; // 5 minutes

/**
 * GET /api/v1/resolve/:name
 * Resolve ENS name to Ethereum address
 */
router.get('/:name',
  cacheMiddleware({ ttl: ENS_CACHE_TTL }),
  async (req, res, next) => {
    try {
      const { name } = req.params;
      const trimmedName = name.trim();
      
      // Check if it's already an address
      if (ethers.isAddress(trimmedName)) {
        const normalizedAddress = ethers.getAddress(trimmedName);
        
        // Try to reverse resolve ENS
        try {
          const ensName = await provider.lookupAddress(normalizedAddress);
          return res.json({
            success: true,
            data: {
              address: normalizedAddress.toLowerCase(),
              ens: ensName,
              resolved: false,
              input: trimmedName
            },
            meta: {
              requestId: req.correlationId,
              timestamp: new Date().toISOString()
            }
          });
        } catch {
          return res.json({
            success: true,
            data: {
              address: normalizedAddress.toLowerCase(),
              ens: null,
              resolved: false,
              input: trimmedName
            },
            meta: {
              requestId: req.correlationId,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
      
      // Check if it looks like an ENS name
      let ensName = trimmedName;
      if (!ensName.includes('.') && !ensName.startsWith('0x')) {
        ensName = `${ensName}.eth`;
      }
      
      // Validate ENS format
      if (!ensName.toLowerCase().endsWith('.eth')) {
        const error = new Error('Invalid ENS name format');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        return next(error);
      }
      
      // Resolve ENS name
      const address = await provider.resolveName(ensName);
      
      if (address) {
        res.json({
          success: true,
          data: {
            address: address.toLowerCase(),
            ens: ensName,
            resolved: true,
            input: trimmedName
          },
          meta: {
            requestId: req.correlationId,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        const error = new Error('ENS name not found');
        error.statusCode = 404;
        error.code = 'NOT_FOUND';
        error.details = { name: ensName };
        next(error);
      }
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
