import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { deployDiamondFixture } from '../fixtures/deployDiamond'
import { ethers } from 'hardhat'

describe('IdentityFacet', function () {
    async function deployFixture() {
        return deployDiamondFixture()
    }

    describe('registerIdentity', function () {
        it('Should allow anyone to register their own identity', async function () {
            const { identity, user1 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc = JSON.stringify({ name: "Test User", org: "Test Org" })

            await expect(identity.connect(user1).registerIdentity(did, didDoc))
                .to.emit(identity, 'IdentityRegistered')
                .withArgs(user1.address, did, await ethers.provider.getBlockNumber().then(async num => {
                    const block = await ethers.provider.getBlock(num + 1)
                    return block!.timestamp
                }))

            const [returnedDid, returnedDoc] = await identity.getIdentity(user1.address)
            expect(returnedDid).to.equal(did)
            expect(returnedDoc).to.equal(didDoc)
        })

        it('Should revert if identity already exists', async function () {
            const { identity, user1 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc = JSON.stringify({ name: "Test User" })

            await identity.connect(user1).registerIdentity(did, didDoc)

            await expect(identity.connect(user1).registerIdentity(did, didDoc))
                .to.be.revertedWith('Identity already exists')
        })

        it('Should revert if DID is already registered', async function () {
            const { identity, user1, user2 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:shared-id`
            const didDoc1 = JSON.stringify({ name: "User 1" })
            const didDoc2 = JSON.stringify({ name: "User 2" })

            await identity.connect(user1).registerIdentity(did, didDoc1)

            await expect(identity.connect(user2).registerIdentity(did, didDoc2))
                .to.be.revertedWith('DID already registered')
        })
    })

    describe('updateIdentity', function () {
        it('Should allow updating DID document', async function () {
            const { identity, user1 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc1 = JSON.stringify({ name: "Test User", org: "Org 1" })
            const didDoc2 = JSON.stringify({ name: "Test User", org: "Org 2 Updated" })

            await identity.connect(user1).registerIdentity(did, didDoc1)

            await expect(identity.connect(user1).updateIdentity(didDoc2))
                .to.emit(identity, 'IdentityUpdated')

            const [, returnedDoc] = await identity.getIdentity(user1.address)
            expect(returnedDoc).to.equal(didDoc2)
        })

        it('Should revert if identity does not exist', async function () {
            const { identity, user1 } = await loadFixture(deployFixture)

            const didDoc = JSON.stringify({ name: "Test User" })

            await expect(identity.connect(user1).updateIdentity(didDoc))
                .to.be.revertedWith('Identity does not exist')
        })
    })

    describe('resolveIdentity', function () {
        it('Should resolve DID to address', async function () {
            const { identity, user1 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc = JSON.stringify({ name: "Test User" })

            await identity.connect(user1).registerIdentity(did, didDoc)

            const resolvedAddress = await identity.resolveIdentity(did)
            expect(resolvedAddress).to.equal(user1.address)
        })

        it('Should return zero address for non-existent DID', async function () {
            const { identity } = await loadFixture(deployFixture)

            const nonExistentDid = "did:ala:quorum:0x0000000000000000000000000000000000000000"
            const resolvedAddress = await identity.resolveIdentity(nonExistentDid)
            expect(resolvedAddress).to.equal(ethers.constants.AddressZero)
        })
    })

    describe('Delegate Management', function () {
        it('Should allow adding delegates', async function () {
            const { identity, user1, user2 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc = JSON.stringify({ name: "Test User" })

            await identity.connect(user1).registerIdentity(did, didDoc)

            await expect(identity.connect(user1).addDelegate(user2.address))
                .to.emit(identity, 'DelegateAdded')
                .withArgs(user1.address, user2.address)

            expect(await identity.isDelegate(user1.address, user2.address)).to.be.true
        })

        it('Should allow removing delegates', async function () {
            const { identity, user1, user2 } = await loadFixture(deployFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc = JSON.stringify({ name: "Test User" })

            await identity.connect(user1).registerIdentity(did, didDoc)
            await identity.connect(user1).addDelegate(user2.address)

            await expect(identity.connect(user1).removeDelegate(user2.address))
                .to.emit(identity, 'DelegateRemoved')
                .withArgs(user1.address, user2.address)

            expect(await identity.isDelegate(user1.address, user2.address)).to.be.false
        })

        it('Should revert if adding delegate to non-existent identity', async function () {
            const { identity, user1, user2 } = await loadFixture(deployFixture)

            await expect(identity.connect(user1).addDelegate(user2.address))
                .to.be.revertedWith('Identity does not exist')
        })

        it('Should revert if removing delegate from non-existent identity', async function () {
            const { identity, user1, user2 } = await loadFixture(deployFixture)

            await expect(identity.connect(user1).removeDelegate(user2.address))
                .to.be.revertedWith('Identity does not exist')
        })
    })

    describe('getIdentity', function () {
        it('Should revert for non-existent identity', async function () {
            const { identity, user1 } = await loadFixture(deployDiamondFixture)

            await expect(identity.getIdentity(user1.address))
                .to.be.revertedWith('Identity does not exist')
        })

        it('Should return correct data including timestamp', async function () {
            const { identity, user1 } = await loadFixture(deployDiamondFixture)

            const did = `did:ala:quorum:${user1.address.toLowerCase()}`
            const didDoc = JSON.stringify({ name: "Test User" })

            await identity.connect(user1).registerIdentity(did, didDoc)

            const [returnedDid, returnedDoc, updatedAt] = await identity.getIdentity(user1.address)
            expect(returnedDid).to.equal(did)
            expect(returnedDoc).to.equal(didDoc)
            expect(updatedAt).to.be.gt(0)
        })
    })
})
