import cloneDeep from 'lodash/cloneDeep';
import size from 'lodash/size';
import get from 'lodash/get';
import filter from 'lodash/filter';
import { iota } from '../libs/iota';
import { updateAddresses, addPendingTransfer, updateUnconfirmedBundleTails } from '../actions/account';
import { generateAlert } from '../actions/alerts';
import { filterSpentAddresses, getUnspentInputs } from '../libs/accountUtils';
import { MAX_SEED_LENGTH } from '../libs/util';

/* eslint-disable no-console */

export const ActionTypes = {
    SET_PROMOTION_STATUS: 'IOTA/TEMP_ACCOUNT/SET_PROMOTION_STATUS',
    GET_TRANSFERS_REQUEST: 'IOTA/TEMP_ACCOUNT/GET_TRANSFERS_REQUEST',
    GET_TRANSFERS_SUCCESS: 'IOTA/TEMP_ACCOUNT/GET_TRANSFERS_SUCCESS',
    GET_TRANSFERS_ERROR: 'IOTA/TEMP_ACCOUNT/GET_TRANSFERS_ERROR',
    GENERATE_NEW_ADDRESS_REQUEST: 'IOTA/TEMP_ACCOUNT/GENERATE_NEW_ADDRESS_REQUEST',
    GENERATE_NEW_ADDRESS_SUCCESS: 'IOTA/TEMP_ACCOUNT/GENERATE_NEW_ADDRESS_SUCCESS',
    GENERATE_NEW_ADDRESS_ERROR: 'IOTA/TEMP_ACCOUNT/GENERATE_NEW_ADDRESS_ERROR',
    MANUAL_SYNC_REQUEST: 'IOTA/TEMP_ACCOUNT/MANUAL_SYNC_REQUEST',
    MANUAL_SYNC_SUCCESS: 'IOTA/TEMP_ACCOUNT/MANUAL_SYNC_SUCCESS',
    MANUAL_SYNC_ERROR: 'IOTA/TEMP_ACCOUNT/MANUAL_SYNC_ERROR',
    SEND_TRANSFER_REQUEST: 'IOTA/TEMP_ACCOUNT/SEND_TRANSFER_REQUEST',
    SEND_TRANSFER_SUCCESS: 'IOTA/TEMP_ACCOUNT/SEND_TRANSFER_SUCCESS',
    SEND_TRANSFER_ERROR: 'IOTA/TEMP_ACCOUNT/SEND_TRANSFER_ERROR',
    SET_COPIED_TO_CLIPBOARD: 'IOTA/TEMP_ACCOUNT/SET_COPIED_TO_CLIPBOARD',
    SET_RECEIVE_ADDRESS: 'IOTA/TEMP_ACCOUNT/SET_RECEIVE_ADDRESS',
    SET_SEED_NAME: 'IOTA/TEMP_ACCOUNT/SET_SEED_NAME',
    SET_PASSWORD: 'IOTA/TEMP_ACCOUNT/SET_PASSWORD',
    CLEAR_TEMP_DATA: 'IOTA/TEMP_ACCOUNT/CLEAR_TEMP_DATA',
    SET_USED_SEED_TO_LOGIN: 'IOTA/TEMP_ACCOUNT/SET_USED_SEED_TO_LOGIN',
    SET_SEED_INDEX: 'IOTA/TEMP_ACCOUNT/SET_SEED_INDEX',
    SET_READY: 'IOTA/TEMP_ACCOUNT/SET_READY',
    SET_SEED: 'IOTA/TEMP_ACCOUNT/SET_SEED',
    CLEAR_SEED: 'IOTA/TEMP_ACCOUNT/CLEAR_SEED',
    SET_SETTING: 'IOTA/TEMP_ACCOUNT/SET_SETTING',
};

export const getTransfersRequest = () => ({
    type: ActionTypes.GET_TRANSFERS_REQUEST,
});

export const getTransfersSuccess = payload => ({
    type: ActionTypes.GET_TRANSFERS_SUCCESS,
    payload,
});

export const getTransfersError = () => ({
    type: ActionTypes.GET_TRANSFERS_ERROR,
});

export const setCopiedToClipboard = payload => ({
    type: ActionTypes.SET_COPIED_TO_CLIPBOARD,
    payload,
});

export const setReceiveAddress = payload => ({
    type: ActionTypes.SET_RECEIVE_ADDRESS,
    payload,
});

export const setUsedSeedToLogin = () => ({
    type: ActionTypes.SET_USED_SEED_TO_LOGIN,
    payload: true,
});

export const setSeedIndex = payload => ({
    type: ActionTypes.SET_SEED_INDEX,
    payload,
});

export const generateNewAddressRequest = () => ({
    type: ActionTypes.GENERATE_NEW_ADDRESS_REQUEST,
});

export const generateNewAddressSuccess = payload => ({
    type: ActionTypes.GENERATE_NEW_ADDRESS_SUCCESS,
    payload,
});

export const generateNewAddressError = () => ({
    type: ActionTypes.GENERATE_NEW_ADDRESS_ERROR,
});

export const manualSyncRequest = () => ({
    type: ActionTypes.MANUAL_SYNC_REQUEST,
});

export const manualSyncSuccess = () => ({
    type: ActionTypes.MANUAL_SYNC_SUCCESS,
});

export const manualSyncError = () => ({
    type: ActionTypes.MANUAL_SYNC_ERROR,
});

export const sendTransferRequest = () => ({
    type: ActionTypes.SEND_TRANSFER_REQUEST,
});

export const sendTransferSuccess = payload => ({
    type: ActionTypes.SEND_TRANSFER_SUCCESS,
    payload,
});

export const sendTransferError = () => ({
    type: ActionTypes.SEND_TRANSFER_ERROR,
});

export const setReady = () => ({
    type: ActionTypes.SET_READY,
    payload: true,
});

export const setSeed = payload => ({
    type: ActionTypes.SET_SEED,
    payload,
});

export const clearSeed = () => ({
    type: ActionTypes.CLEAR_SEED,
    payload: Array(82).join(' '),
});

export const setSetting = payload => ({
    type: ActionTypes.SET_SETTING,
    payload,
});

export const clearTempData = () => ({
    type: ActionTypes.CLEAR_TEMP_DATA,
});

export const setPassword = payload => ({
    type: ActionTypes.SET_PASSWORD,
    payload,
});

export const setSeedName = payload => ({
    type: ActionTypes.SET_SEED_NAME,
    payload,
});

export const setPromotionStatus = payload => ({
    type: ActionTypes.SET_PROMOTION_STATUS,
    payload,
});

export const generateNewAddress = (seed, seedName, addresses) => {
    return dispatch => {
        let index = 0;

        size(addresses) === 0 ? (index = 0) : (index = size(addresses) - 1);
        const options = { checksum: true, index };

        iota.api.getNewAddress(seed, options, (error, address) => {
            if (!error) {
                //const addressToCheck = [{ address: address }];
                //Promise.resolve(filterSpentAddresses(addressToCheck)).then(value => console.log(value));

                const updatedAddresses = cloneDeep(addresses);
                const addressNoChecksum = address.substring(0, MAX_SEED_LENGTH);
                // In case the newly created address is not part of the addresses object
                // Add that as a key with a 0 balance.
                if (!(addressNoChecksum in addresses)) {
                    updatedAddresses[addressNoChecksum] = { balance: 0, spent: false };
                }

                dispatch(updateAddresses(seedName, updatedAddresses));
                dispatch(generateNewAddressSuccess(address));
            } else {
                dispatch(generateNewAddressError());
            }
        });
    };
};

export const sendTransaction = (seed, currentSeedAccountInfo, seedName, address, value, message, cb) => {
    return dispatch => {
        const verifyAndSend = (filtered, expectedOutputsLength, transfer, inputs) => {
            if (filtered.length !== expectedOutputsLength) {
                return dispatch(
                    generateAlert(
                        'error',
                        'Key reuse',
                        'You cannot send to an address that has already been spent from.',
                    ),
                );
            }
            // Send transfer with depth 4 and minWeightMagnitude 14
            const addressData = currentSeedAccountInfo.addresses;
            const transfers = currentSeedAccountInfo.transfers;
            const options = { inputs };

            return iota.api.sendTransfer(seed, 4, 14, transfer, options, (error, success) => {
                if (!error) {
                    dispatch(checkForNewAddress(seedName, addressData, success));
                    dispatch(addPendingTransfer(seedName, transfers, success));
                    console.log(success);
                    dispatch(generateAlert('success', 'Transfer sent', 'Your transfer has been sent to the Tangle.'));
                    dispatch(sendTransferSuccess({ address, value }));
                    cb();

                    // Keep track of this transfer in unconfirmed tails so that it can be picked up for promotion
                    // Would be the tail anyways.
                    // Also check if it was a value transfer
                    if (value) {
                        const bundle = get(success, `[${0}].bundle`);
                        dispatch(
                            updateUnconfirmedBundleTails({ [bundle]: filter(success, tx => tx.currentIndex === 0) }),
                        );
                    }
                } else {
                    dispatch(sendTransferError());
                    dispatch(
                        generateAlert(
                            'error',
                            'Invalid Response',
                            'The node returned an invalid response while sending transfer.',
                        ),
                    );
                }
            });
        };

        const unspentInputs = (err, inputs) => {
            if (err && err.message !== 'Not enough balance') {
                dispatch(sendTransferError());
                return dispatch(
                    generateAlert(
                        'error',
                        'Transfer Error',
                        'Something went wrong while sending your transfer. Please try again.',
                    ),
                );
            } else {
                if (get(inputs, 'allBalance') < value) {
                    dispatch(sendTransferError());
                    return dispatch(
                        generateAlert(
                            'error',
                            'Not enough balance',
                            'You do not have enough IOTA to complete this transfer.',
                        ),
                    );
                } else if (get(inputs, 'totalBalance') < value) {
                    dispatch(sendTransferError());
                    return dispatch(
                        generateAlert(
                            'error',
                            'Key reuse',
                            'You cannot send to an address that has already been spent from.',
                        ),
                    );
                }

                const tag = 'IOTA';
                const transfer = [
                    {
                        address: address,
                        value: value,
                        message: iota.utils.toTrytes(message),
                        tag: iota.utils.toTrytes(tag),
                    },
                ];

                const outputsToCheck = transfer.map(t => ({ address: iota.utils.noChecksum(t.address) }));

                // Check to make sure user is not sending to an already used address
                return filterSpentAddresses(outputsToCheck).then(filtered =>
                    verifyAndSend(filtered, outputsToCheck.length, transfer, get(inputs, 'inputs')),
                );
            }
        };

        return getUnspentInputs(seed, 0, value, null, unspentInputs);
    };
};

export const checkForNewAddress = (seedName, addressData, txArray) => {
    return dispatch => {
        // Check if 0 value transfer
        if (txArray[0].value != 0) {
            const changeAddress = txArray[txArray.length - 1].address;
            const addresses = Object.keys(addressData);
            // Remove checksum
            const addressNoChecksum = changeAddress.substring(0, MAX_SEED_LENGTH);
            // If current addresses does not include change address, add new address and balance
            if (!addresses.includes(addressNoChecksum)) {
                const addressArray = [addressNoChecksum];
                // Check change address balance
                iota.api.getBalances(addressArray, 1, (error, success) => {
                    if (!error) {
                        const addressBalance = parseInt(success.balances[0]);
                        addressData[addressNoChecksum] = { balance: addressBalance, spent: false };
                    } else {
                        addressData[addressNoChecksum] = { balance: 0, spent: false };
                    }
                });
            }
            dispatch(updateAddresses(seedName, addressData));
        }
    };
};

export const randomiseSeed = randomBytesFn => {
    return dispatch => {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9';
        let seed = '';
        // uncomment for synchronous API, uses SJCL
        // var rand = randomBytes(1)

        // asynchronous API, uses iOS-side SecRandomCopyBytes
        randomBytesFn(100, (error, bytes) => {
            if (!error) {
                Object.keys(bytes).forEach(key => {
                    if (bytes[key] < 243 && seed.length < MAX_SEED_LENGTH) {
                        const randomNumber = bytes[key] % 27;
                        const randomLetter = charset.charAt(randomNumber);
                        seed += randomLetter;
                    }
                });
                dispatch(setSeed(seed));
            } else {
                console.log(error);
                dispatch(generateAlert('error', 'Something went wrong', 'Please restart the app.'));
            }
        });
    };
};
