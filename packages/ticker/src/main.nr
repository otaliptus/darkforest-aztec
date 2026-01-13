use dep::aztec::macros::aztec;

#[aztec]
pub contract Ticker {
    use dep::aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        state_vars::PublicMutable,
    };

    #[storage]
    struct Storage<Context> {
        counter: PublicMutable<u64, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor() {
        self.storage.counter.write(0);
    }

    #[external("public")]
    fn tick() {
        let current = self.storage.counter.read();
        self.storage.counter.write(current + 1);
    }
}
