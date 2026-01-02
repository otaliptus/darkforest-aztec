use dep::aztec::macros::aztec;

#[aztec]
pub contract NFT {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol_types::address::AztecAddress,
        state_vars::{Map, PublicMutable},
    };

    #[storage]
    struct Storage<Context> {
        minter: PublicMutable<AztecAddress, Context>,
        public_owners: Map<Field, PublicMutable<AztecAddress, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(minter: AztecAddress) {
        self.storage.minter.write(minter);
    }

    #[external("public")]
    fn set_minter(minter: AztecAddress) {
        let sender = self.context.msg_sender().unwrap();
        assert(sender.eq(self.storage.minter.read()));
        self.storage.minter.write(minter);
    }

    #[external("public")]
    fn mint(to: AztecAddress, token_id: Field) {
        let sender = self.context.msg_sender().unwrap();
        assert(sender.eq(self.storage.minter.read()));
        self.storage.public_owners.at(token_id).write(to);
    }

    #[external("public")]
    fn transfer_in_public(
        _from: AztecAddress,
        to: AztecAddress,
        token_id: Field,
        _authwit_nonce: Field,
    ) {
        let sender = self.context.msg_sender().unwrap();
        assert(sender.eq(self.storage.minter.read()));
        self.storage.public_owners.at(token_id).write(to);
    }

    #[external("public")]
    fn burn(token_id: Field) {
        let sender = self.context.msg_sender().unwrap();
        assert(sender.eq(self.storage.minter.read()));
        self.storage.public_owners.at(token_id).write(AztecAddress::zero());
    }
}
