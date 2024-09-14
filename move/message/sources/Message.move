
module Message::message {
    use std::string::{Self, String};
    use std::signer;

    struct MessageData has key {
        message: String,
    }

    fun init_module(creator: &signer){
        move_to(creator, MessageData {
            message: string::utf8(b"Hello from Apollo")
        });
    }

    public entry fun create_user_message (user: &signer, message: String){
        move_to(user, MessageData {
            message
        });
    }

    public entry fun edit_user_message (creator: &signer, user: &signer, message: String) acquires MessageData {
        if (!exists<MessageData>(signer::address_of(creator))){
            abort(400)
        };
        let message_mut = borrow_global_mut<MessageData>(signer::address_of(user));
        message_mut.message = message;
    }

     public entry fun edit_user_message_two (user: &signer, message: String) acquires MessageData {
        let message_mut = borrow_global_mut<MessageData>(signer::address_of(user));
        message_mut.message = message;
    }

    #[view]
    public fun get_user_message(user_address: address):String acquires MessageData {
        let message = borrow_global<MessageData>(user_address).message;
        message
    }


    #[test (creator = @Message, user = @0x122 )]
    fun test_contract(creator: &signer, user: &signer) acquires MessageData{
        init_module(creator);
        let message_one = string::utf8(b"This is not a drill");
        let message_two = string::utf8(b"This is not a drill");
        create_user_message(user, message_one);
        let saved_msg_one = borrow_global<MessageData>(signer::address_of(user)).message;
        assert!(saved_msg_one == message_one, 900);
        edit_user_message(creator, user, message_two);
        let saved_msg_two = borrow_global<MessageData>(signer::address_of(user)).message;
        assert!(saved_msg_two == message_two, 901);
    }
}
